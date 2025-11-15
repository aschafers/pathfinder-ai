import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface DrillingCanvasProps {
  projectId: string;
}

const DrillingCanvas = ({ projectId }: DrillingCanvasProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Fetch project data and subscribe to updates
  useEffect(() => {
    const fetchProject = async () => {
      const { data } = await supabase
        .from('projects')
        .select('current_image_url')
        .eq('id', projectId)
        .single();
      
      if (data?.current_image_url) {
        setImageUrl(data.current_image_url);
      }
    };

    fetchProject();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('drilling-image-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`
        },
        (payload) => {
          console.log('Project updated:', payload);
          if (payload.new.current_image_url) {
            setImageUrl(payload.new.current_image_url);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);


  return (
    <div className="h-full p-4 flex flex-col">
      <Card className="flex-1 border-border bg-card/30 backdrop-blur-sm overflow-hidden">
        <div className="h-full relative flex items-center justify-center bg-black">
          {imageUrl ? (
            <img 
              key={imageUrl}
              src={imageUrl} 
              alt="Drilling progress visualization" 
              className="w-full h-full object-contain"
            />
          ) : (
            <p className="text-muted-foreground text-center">
              No visualization available yet. Start drilling to see the progress.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default DrillingCanvas;
