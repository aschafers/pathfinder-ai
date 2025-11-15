import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface DrillingCanvasProps {
  projectId: string;
}

interface DrillingPoint {
  x: number;
  y: number;
  z: number;
}

interface DrillingPath {
  points: DrillingPoint[];
  status?: string;
  obstacle_detected?: boolean;
  obstacle_position?: DrillingPoint;
}

const DrillingCanvas = ({ projectId }: DrillingCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drillingPath, setDrillingPath] = useState<DrillingPath | null>(null);

  // Fetch project data and subscribe to updates
  useEffect(() => {
    const fetchProject = async () => {
      const { data } = await supabase
        .from('projects')
        .select('drilling_path_data')
        .eq('id', projectId)
        .single();
      
      if (data?.drilling_path_data) {
        setDrillingPath(data.drilling_path_data as unknown as DrillingPath);
      }
    };

    fetchProject();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('drilling-path-updates')
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
          if (payload.new.drilling_path_data) {
            setDrillingPath(payload.new.drilling_path_data as unknown as DrillingPath);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Draw canvas when drilling path changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Draw background grid
    ctx.strokeStyle = "rgba(0, 255, 255, 0.1)";
    ctx.lineWidth = 1;

    const gridSize = 50;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw sample geological layers
    const layers = [
      { y: 100, height: 80, color: "rgba(100, 100, 100, 0.3)", label: "Topsoil" },
      { y: 180, height: 120, color: "rgba(80, 80, 80, 0.3)", label: "Clay" },
      { y: 300, height: 150, color: "rgba(60, 60, 60, 0.3)", label: "Sandstone" },
      { y: 450, height: 100, color: "rgba(90, 90, 90, 0.3)", label: "Bedrock" },
    ];

    layers.forEach((layer) => {
      ctx.fillStyle = layer.color;
      ctx.fillRect(0, layer.y, canvas.width, layer.height);
      
      ctx.strokeStyle = "rgba(0, 255, 255, 0.2)";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, layer.y, canvas.width, layer.height);

      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "12px monospace";
      ctx.fillText(layer.label, 20, layer.y + 30);
    });

    // Draw drilling path if available
    if (drillingPath?.points && drillingPath.points.length > 0) {
      ctx.strokeStyle = "rgba(0, 255, 255, 0.8)";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#00FFFF";

      ctx.beginPath();
      
      // Scale points to canvas size
      const scaleX = canvas.width / 200; // Assuming max x coordinate around 200
      const scaleZ = canvas.height / 200; // Assuming max depth around 200
      
      drillingPath.points.forEach((point, index) => {
        const x = canvas.width / 2 + point.x * scaleX;
        const y = 50 + Math.abs(point.z) * scaleZ;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();

      // Draw drill head at last point
      const lastPoint = drillingPath.points[drillingPath.points.length - 1];
      const lastX = canvas.width / 2 + lastPoint.x * scaleX;
      const lastY = 50 + Math.abs(lastPoint.z) * scaleZ;
      
      ctx.shadowBlur = 30;
      ctx.fillStyle = "#00FFFF";
      ctx.beginPath();
      ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
      ctx.fill();

      // Draw obstacle if detected
      if (drillingPath.obstacle_detected && drillingPath.obstacle_position) {
        const obsX = canvas.width / 2 + drillingPath.obstacle_position.x * scaleX;
        const obsY = 50 + Math.abs(drillingPath.obstacle_position.z) * scaleZ;
        
        ctx.shadowBlur = 20;
        ctx.fillStyle = "rgba(255, 0, 255, 0.6)";
        ctx.beginPath();
        ctx.arc(obsX, obsY, 15, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Add depth markers
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "11px monospace";
    for (let i = 0; i <= 5; i++) {
      const y = i * 100 + 50;
      ctx.fillText(`${i * 10}m`, 10, y);
    }
  }, [drillingPath]);

  return (
    <div className="h-full p-4 flex flex-col">
      <Card className="flex-1 border-border bg-card/30 backdrop-blur-sm overflow-hidden">
        <div className="h-full relative">
          <div className="absolute top-4 right-4 z-10 bg-card/80 backdrop-blur-sm border border-border rounded-lg p-3">
            <h3 className="text-sm font-semibold text-primary mb-2">2D Cross-Section</h3>
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" style={{ boxShadow: "0 0 10px #00FFFF" }} />
                <span>Optimal Path</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-success" style={{ boxShadow: "0 0 10px #00FF00" }} />
                <span>Safe Zone</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-secondary" style={{ boxShadow: "0 0 10px #FF00FF" }} />
                <span>Risk Zone</span>
              </div>
            </div>
          </div>
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ imageRendering: "crisp-edges" }}
          />
        </div>
      </Card>
    </div>
  );
};

export default DrillingCanvas;
