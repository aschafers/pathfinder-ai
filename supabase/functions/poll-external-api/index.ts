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

    // Perform polling iterations
    const results = [];
    for (let i = 0; i < iterations; i++) {
      const currentIndex = project.current_index + i;
      
      console.log(`Fetching data for index ${currentIndex}`);
      
      try {
        // Call external API with index parameter
        const apiUrl = `${project.external_api_url}?index=${currentIndex}`;
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

        // Get existing drilling path or initialize
        const existingPath = project.drilling_path_data as any || { points: [], status: 'in_progress', obstacle_detected: false };
        
        // Calculate new point based on action data
        const lastPoint = existingPath.points.length > 0 
          ? existingPath.points[existingPath.points.length - 1]
          : { x: 0, y: 0, z: 0 };
        
        // Convert inclination and azimuth to x, y, z coordinates
        const stepMd = data.action?.step_md || 10;
        const inclination = (data.action?.inclination || 0) * Math.PI / 180;
        const azimuth = (data.action?.azimuth || 0) * Math.PI / 180;
        
        const newPoint = {
          x: lastPoint.x + stepMd * Math.sin(inclination) * Math.cos(azimuth),
          y: lastPoint.y + stepMd * Math.sin(inclination) * Math.sin(azimuth),
          z: lastPoint.z - stepMd * Math.cos(inclination)
        };
        
        existingPath.points.push(newPoint);
        existingPath.status = data.action?.action === 'drill' ? 'drilling' : 'stopped';

        // Update project with new data
        const updateData: any = {
          current_index: currentIndex + 1,
          meters_drilled: data.current_md || project.meters_drilled,
          precision_improvement: project.precision_improvement,
          image_quality: project.image_quality,
          drilling_path_data: existingPath,
        };

        await supabase
          .from('projects')
          .update(updateData)
          .eq('id', projectId);

        // Create a chat message with the new data
        await supabase
          .from('chat_messages')
          .insert({
            project_id: projectId,
            role: 'assistant',
            content: `📊 Itération ${data.iteration || currentIndex}: ${data.current_md || 0}m forés, lithologie: ${data.observed_lithology || 'inconnu'}, action: ${data.action?.action || 'N/A'}`,
            metadata: { 
              source: 'external_api', 
              index: currentIndex,
              iteration: data.iteration,
              lithology: data.observed_lithology,
              action: data.action
            },
          });

        console.log(`Successfully processed index ${currentIndex}`);

        // Wait for the specified interval before next iteration (except on last iteration)
        if (i < iterations - 1) {
          await new Promise(resolve => setTimeout(resolve, project.polling_interval * 1000));
        }
      } catch (error) {
        console.error(`Error fetching index ${currentIndex}:`, error);
        results.push({
          index: currentIndex,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Mark polling as inactive
    await supabase
      .from('projects')
      .update({ polling_active: false })
      .eq('id', projectId);

    console.log(`Polling completed for project ${projectId}`);

    return new Response(
      JSON.stringify({
        success: true,
        results: results,
        message: `Completed ${results.length} polling iterations`,
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
