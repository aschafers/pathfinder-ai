import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface DrillingCanvasProps {
  projectId: string;
}

const DrillingCanvas = ({ projectId }: DrillingCanvasProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [nextImageUrl, setNextImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Preload image before displaying
  useEffect(() => {
    if (!nextImageUrl || nextImageUrl === imageUrl) return;

    setIsLoading(true);
    const img = new Image();
    img.onload = () => {
      setImageUrl(nextImageUrl);
      setIsLoading(false);
    };
    img.onerror = () => {
      console.error('Failed to load image:', nextImageUrl);
      setImageUrl(nextImageUrl); // Still update to show error
      setIsLoading(false);
    };
    img.src = nextImageUrl;
  }, [nextImageUrl, imageUrl]);

  // Fetch project data and subscribe to updates
  useEffect(() => {
    const fetchProject = async () => {
      const { data } = await supabase
        .from('projects')
        .select('current_image_url')
        .eq('id', projectId)
        .single();
      
      if (data?.current_image_url) {
        setNextImageUrl(data.current_image_url);
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
          if (payload.new.current_image_url && payload.new.current_image_url !== nextImageUrl) {
            setNextImageUrl(payload.new.current_image_url);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, nextImageUrl]);


  return (
    <div className="h-full p-4 flex flex-col">
      <Card className="flex-1 border-border bg-card/30 backdrop-blur-sm overflow-hidden">
        <div className="h-full relative flex items-center justify-center bg-black">
          {imageUrl ? (
            <>
              <img 
                src={imageUrl} 
                alt="Drilling progress visualization" 
                className="w-full h-full object-contain transition-opacity duration-300"
                style={{ opacity: isLoading ? 0.5 : 1 }}
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </>
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
