import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Plus, LogOut, Activity } from "lucide-react";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  meters_drilled: number;
  precision_improvement: number;
  image_quality: number;
  created_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    fetchProjects();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast.error("Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  };

  const createNewProject = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("projects")
        .insert({
          name: `Project ${projects.length + 1}`,
          description: "New drilling project",
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      navigate(`/workspace/${data.id}`);
    } catch (error: any) {
      toast.error("Failed to create project");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
            P-Twin Dashboard
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="border-border hover:bg-muted"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Your Projects</h2>
            <p className="text-muted-foreground">
              Manage and track your drilling analysis projects
            </p>
          </div>
          <Button
            onClick={createNewProject}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-border bg-card/50 backdrop-blur-sm animate-pulse">
                <CardHeader className="h-24" />
                <CardContent className="h-32" />
              </Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center mb-4">
                No projects yet. Create your first drilling analysis project to get started.
              </p>
              <Button onClick={createNewProject} className="bg-primary hover:bg-primary/90">
                Create First Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="border-border bg-card/50 backdrop-blur-sm hover:border-primary transition-colors cursor-pointer group"
                onClick={() => navigate(`/workspace/${project.id}`)}
              >
                <CardHeader>
                  <CardTitle className="group-hover:text-primary transition-colors">
                    {project.name}
                  </CardTitle>
                  <CardDescription>{project.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="text-success font-mono">
                        {project.meters_drilled}m drilled
                      </span>
                    </div>
                    <Progress value={project.image_quality} className="h-2" />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Precision</span>
                    <span className="text-primary font-mono">
                      +{project.precision_improvement.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Image Quality</span>
                    <span className="font-mono">{project.image_quality}%</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
