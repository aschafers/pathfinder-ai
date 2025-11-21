import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, iterations = 5 } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;
    if (!project.external_api_url) {
      throw new Error('No external API URL configured');
    }

    console.log(`Starting polling for project ${projectId}`);

    // Mark polling as active
    await supabase
      .from('projects')
      .update({ polling_active: true })
      .eq('id', projectId);

    // Start polling in background (don't await)
    performPolling(supabase, project, iterations, projectId).catch(err => 
      console.error('Background polling error:', err)
    );

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        message: `Polling started for ${iterations} iterations`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in poll-external-api function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function performPolling(supabase: any, project: any, iterations: number, projectId: string) {
  const results = [];
  
  // Initialize drilling path accumulator
  const accumulatedPath = project.drilling_path_data as any || { points: [], status: 'in_progress', obstacle_detected: false };
  
  for (let i = 0; i < iterations; i++) {
    // Check if polling has been stopped by user
    const { data: currentProject } = await supabase
      .from('projects')
      .select('polling_active')
      .eq('id', projectId)
      .single();
    
    if (!currentProject?.polling_active) {
      console.log('Polling stopped by user');
      break;
    }

    const currentIndex = project.current_index + i;
    
    console.log(`Fetching data for index ${currentIndex}`);
    
    try {
      // Call external API with index parameter and hardcoded path
      const apiUrl = `${project.external_api_url}/drilling-data?index=${currentIndex}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        console.error(`API request failed with status ${response.status}`);
        continue;
      }

      const data = await response.json();
      results.push({
        index: currentIndex,
        data: data,
        timestamp: new Date().toISOString(),
      });

      // Handle frame image if provided via frame_path
      let imageUrl = project.current_image_url;
      if (data.frame_path) {
        try {
          // Fetch image from external API
          const imageApiUrl = `${project.external_api_url}/${data.frame_path}`;
          console.log(`Fetching image from: ${imageApiUrl}`);
          
          const imageResponse = await fetch(imageApiUrl);
          if (!imageResponse.ok) {
            console.error(`Failed to fetch image: ${imageResponse.status}`);
          } else {
            // Get image as array buffer
            const imageBuffer = await imageResponse.arrayBuffer();
            const imageData = new Uint8Array(imageBuffer);
            
            // Upload to Supabase Storage
            const fileName = `${projectId}/frame_${currentIndex}_${Date.now()}.png`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('project-images')
              .upload(fileName, imageData, {
                contentType: 'image/png',
                upsert: true
              });

            if (!uploadError && uploadData) {
              const { data: urlData } = supabase.storage
                .from('project-images')
                .getPublicUrl(fileName);
              imageUrl = urlData.publicUrl;
              console.log(`Image uploaded successfully: ${imageUrl}`);
            } else {
              console.error('Error uploading image:', uploadError);
            }
          }
        } catch (error) {
          console.error('Error fetching/uploading image:', error);
        }
      }

      // Calculate new point based on action data
      const lastPoint = accumulatedPath.points.length > 0 
        ? accumulatedPath.points[accumulatedPath.points.length - 1]
        : { x: 0, y: 0, depth: 0 };

      let newPoint;
      if (data.action) {
        const { step_md, inclination, azimuth } = data.action;
        
        // Convert drilling action to coordinates (simplified)
        const deltaDepth = step_md * Math.cos(inclination * Math.PI / 180);
        const horizontalDistance = step_md * Math.sin(inclination * Math.PI / 180);
        const deltaX = horizontalDistance * Math.cos(azimuth * Math.PI / 180);
        const deltaY = horizontalDistance * Math.sin(azimuth * Math.PI / 180);
        
        newPoint = {
          x: lastPoint.x + deltaX,
          y: lastPoint.y + deltaY,
          depth: lastPoint.depth + deltaDepth,
          iteration: i + 1,
          lithology: data.observed_lithology || 'Unknown'
        };
      } else {
        // Fallback if no action data
        newPoint = {
          x: lastPoint.x,
          y: lastPoint.y,
          depth: lastPoint.depth + 10, // Default 10m increment
          iteration: i + 1,
          lithology: data.observed_lithology || 'Unknown'
        };
      }

      accumulatedPath.points.push(newPoint);

      // Update project with latest data
      const metersDrilled = data.current_md || (project.meters_drilled + 30);
      await supabase
        .from('projects')
        .update({
          current_index: currentIndex,
          current_image_url: imageUrl,
          meters_drilled: metersDrilled,
          drilling_path_data: accumulatedPath,
          precision_improvement: data.precision_improvement || project.precision_improvement,
          image_quality: data.image_quality || project.image_quality,
        })
        .eq('id', projectId);

      // Create chat message with drilling results
      const messageContent = `**Drilling Update - Index ${currentIndex}**\n\n` +
        `📊 **Metrics:**\n` +
        `- Depth: ${metersDrilled}m\n` +
        `- Lithology: ${newPoint.lithology}\n` +
        `- Position: X=${newPoint.x.toFixed(2)}m, Y=${newPoint.y.toFixed(2)}m\n\n` +
        (data.action ? `🎯 **Action Taken:**\n` +
        `- Step MD: ${data.action.step_md}m\n` +
        `- Inclination: ${data.action.inclination}°\n` +
        `- Azimuth: ${data.action.azimuth}°\n\n` : '') +
        (data.precision_improvement ? `✨ Precision: ${data.precision_improvement}%\n` : '') +
        (data.image_quality ? `🖼️ Image Quality: ${data.image_quality}%` : '');

      await supabase
        .from('chat_messages')
        .insert({
          project_id: projectId,
          role: 'assistant',
          content: messageContent,
          image_url: imageUrl
        });

      console.log(`Successfully processed index ${currentIndex} - ${metersDrilled}m drilled`);

      // Wait 5 seconds between iterations (configurable)
      await new Promise(resolve => setTimeout(resolve, project.polling_interval * 1000 || 5000));

    } catch (error) {
      console.error(`Error processing index ${currentIndex}:`, error);
      continue;
    }
  }

  // Mark polling as inactive
  await supabase
    .from('projects')
    .update({ polling_active: false })
    .eq('id', projectId);

  console.log(`Polling completed for project ${projectId}`);
}
