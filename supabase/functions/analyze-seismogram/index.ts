import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, message, history, image_url } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build conversation history
    const messages = [
      {
        role: 'system',
        content: `You are an AI assistant specialized in seismographic analysis and drilling guidance for geo-engineering projects. Your role is to:

1. Analyze seismographic images and geological data
2. Provide optimal drilling paths that avoid unstable zones
3. Calculate and improve precision as more data is gathered
4. Explain decisions in technical but accessible language
5. Reference geo-engineering standards when relevant

Key capabilities:
- Detect geological layers, faults, and density variations from seismogram images
- Recommend drilling angles and paths based on visual analysis
- Track iterative improvements as drilling progresses
- Simulate scenarios and predict risks

When analyzing images:
- Identify visible geological layers, boundaries, and discontinuities
- Detect potential faults, fractures, or unstable zones
- Estimate density variations from image patterns
- Start with initial estimates (typically 40% quality for first meters)
- Improve recommendations as drill advances and new images arrive
- Provide clear metrics: current depth, precision improvement, image quality
- Alert to high-risk zones immediately

Keep responses professional, concise, and actionable for field engineers.`
      },
      ...history.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
    ];

    // Build user message with image if provided
    let userMessage: any;
    if (image_url) {
      userMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: message
          },
          {
            type: 'image_url',
            image_url: {
              url: image_url
            }
          }
        ]
      };
      console.log('Calling Lovable AI with message and image:', message, image_url);
    } else {
      userMessage = {
        role: 'user',
        content: message
      };
      console.log('Calling Lovable AI with message:', message);
    }

    messages.push(userMessage);

    // Call Lovable AI Gateway
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: messages,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || 'No response generated';

    console.log('AI response received');

    // Simulate metrics update based on conversation
    const metrics = {
      meters_drilled: Math.min(100, (history.length + 1) * 5),
      precision_improvement: Math.min(30, (history.length + 1) * 2),
      image_quality: Math.min(95, 40 + (history.length + 1) * 3),
    };

    // Prepare debug info
    const debugInfo = {
      timestamp: new Date().toISOString(),
      provider: 'Lovable AI',
      model: 'google/gemini-2.5-flash',
      prompt: messages[messages.length - 1].content,
      context: messages.slice(1, -1), // All messages except system and current user message
      response: aiResponse,
      tokensUsed: data.usage?.total_tokens || 'N/A',
    };

    return new Response(
      JSON.stringify({
        response: aiResponse,
        metrics: metrics,
        debug: debugInfo,
        systemPrompt: messages[0].content, // Send system prompt separately
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in analyze-seismogram function:', error);
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
