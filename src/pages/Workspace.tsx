import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Send, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import DrillingCanvas from "@/components/DrillingCanvas";
import DebugPanel from "@/components/DebugPanel";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url?: string;
}

interface DebugEntry {
  timestamp: string;
  provider: string;
  model: string;
  prompt: string | any;
  context: any[];
  response: string;
  tokensUsed: string | number;
}

interface Project {
  id: string;
  name: string;
  meters_drilled: number;
  precision_improvement: number;
  image_quality: number;
  initial_image_url?: string;
  current_image_url?: string;
  external_api_url?: string;
  current_index: number;
  polling_active: boolean;
  polling_interval: number;
}

const Workspace = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [apiUrl, setApiUrl] = useState("https://8917d9e1ffac.ngrok-free.app");
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([]);
  const [systemPrompt, setSystemPrompt] = useState<string>("");

  useEffect(() => {
    fetchProject();
    fetchMessages();
    
    // Subscribe to project updates
    const channel = supabase
      .channel(`project-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          console.log('Project updated:', payload);
          setProject(payload.new as Project);
        }
      )
      .subscribe();

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel(`messages-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          console.log('New message:', payload);
          const newMsg = payload.new as any;
          
          // Avoid duplicates - only add if message doesn't exist
          setMessages((prev) => {
            const exists = prev.some(m => m.id === newMsg.id);
            if (exists) return prev;
            
            return [...prev, {
              id: newMsg.id,
              role: newMsg.role,
              content: newMsg.content,
              image_url: newMsg.image_url || undefined,
            }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(messagesChannel);
    };
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (project?.external_api_url) {
      setApiUrl(project.external_api_url);
    } else {
      setApiUrl("https://8917d9e1ffac.ngrok-free.app");
    }
  }, [project]);

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      toast.error("Failed to load project");
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      const typedMessages: Message[] = (data || []).map(msg => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        image_url: msg.image_url || undefined,
      }));
      
      setMessages(typedMessages);
    } catch (error) {
      toast.error("Failed to load messages");
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput("");
    setIsLoading(true);

    try {
      // Save user message
      const { data: userMsg, error: userError } = await supabase
        .from("chat_messages")
        .insert({
          project_id: projectId,
          role: "user",
          content: userMessage,
        })
        .select()
        .single();

      if (userError) throw userError;
      
      // Add user message immediately for feedback
      const typedUserMsg: Message = {
        id: userMsg.id,
        role: userMsg.role as "user",
        content: userMsg.content,
        image_url: userMsg.image_url || undefined,
      };
      setMessages((prev) => [...prev, typedUserMsg]);

      // Call AI edge function
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke(
        "analyze-seismogram",
        {
          body: {
            projectId,
            message: userMessage,
            history: messages,
          },
        }
      );

      if (aiError) throw aiError;

      // Store debug info if available
      if (aiResponse.debug) {
        setDebugEntries(prev => [...prev, aiResponse.debug]);
      }
      
      // Store system prompt (only first time)
      if (aiResponse.systemPrompt && !systemPrompt) {
        setSystemPrompt(aiResponse.systemPrompt);
      }

      // Save AI response
      const { data: aiMsg, error: aiMsgError } = await supabase
        .from("chat_messages")
        .insert({
          project_id: projectId,
          role: "assistant",
          content: aiResponse.response,
        })
        .select()
        .single();

      if (aiMsgError) throw aiMsgError;
      
      // Don't add manually - let realtime subscription handle it
      // const typedAiMsg: Message = {
      //   id: aiMsg.id,
      //   role: aiMsg.role as "assistant",
      //   content: aiMsg.content,
      //   image_url: aiMsg.image_url || undefined,
      // };
      // setMessages((prev) => [...prev, typedAiMsg]);

      // Update project metrics if provided
      if (aiResponse.metrics) {
        await supabase
          .from("projects")
          .update(aiResponse.metrics)
          .eq("id", projectId);
        fetchProject();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload to storage with user-specific path
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${projectId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('seismogram-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('seismogram-images')
        .getPublicUrl(fileName);

      // Send message with image
      const messageText = input.trim() || "New seismogram image uploaded for analysis";
      setInput("");

      // Save user message with image
      const { data: userMsg, error: userError } = await supabase
        .from("chat_messages")
        .insert({
          project_id: projectId,
          role: "user",
          content: messageText,
          image_url: publicUrl,
        })
        .select()
        .single();

      if (userError) throw userError;
      
      // Add user message immediately for feedback
      const typedUserMsg: Message = {
        id: userMsg.id,
        role: userMsg.role as "user",
        content: userMsg.content,
        image_url: userMsg.image_url || undefined,
      };
      setMessages((prev) => [...prev, typedUserMsg]);

      // Update project with image URL
      await supabase
        .from("projects")
        .update({ 
          current_image_url: publicUrl,
          initial_image_url: project?.initial_image_url || publicUrl 
        })
        .eq("id", projectId);

      // Call AI with image
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke(
        "analyze-seismogram",
        {
          body: {
            projectId,
            message: messageText,
            image_url: publicUrl,
            history: messages,
          },
        }
      );

      if (aiError) throw aiError;

      // Store debug info if available
      if (aiResponse.debug) {
        setDebugEntries(prev => [...prev, aiResponse.debug]);
      }
      
      // Store system prompt (only first time)
      if (aiResponse.systemPrompt && !systemPrompt) {
        setSystemPrompt(aiResponse.systemPrompt);
      }

      // Save AI response
      const { data: aiMsg, error: aiMsgError } = await supabase
        .from("chat_messages")
        .insert({
          project_id: projectId,
          role: "assistant",
          content: aiResponse.response,
        })
        .select()
        .single();

      if (aiMsgError) throw aiMsgError;
      
      // Don't add manually - let realtime subscription handle it
      // const typedAiMsg: Message = {
      //   id: aiMsg.id,
      //   role: aiMsg.role as "assistant",
      //   content: aiMsg.content,
      //   image_url: aiMsg.image_url || undefined,
      // };
      // setMessages((prev) => [...prev, typedAiMsg]);

      // Update metrics
      if (aiResponse.metrics) {
        await supabase
          .from("projects")
          .update(aiResponse.metrics)
          .eq("id", projectId);
        fetchProject();
      }

      toast.success("Image uploaded and analyzed!");
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || "Failed to upload image");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveApiUrl = async () => {
    if (!apiUrl.trim()) {
      toast.error("Please enter a valid API URL");
      return;
    }

    try {
      const { error } = await supabase
        .from("projects")
        .update({ external_api_url: apiUrl })
        .eq("id", projectId);

      if (error) throw error;

      toast.success("API URL configured successfully!");
      setShowApiConfig(false);
      fetchProject();
    } catch (error) {
      toast.error("Failed to save API URL");
    }
  };

  const handleRestartDrilling = async () => {
    if (project?.polling_active) {
      toast.error("Cannot restart while drilling is active");
      return;
    }

    setIsLoading(true);
    try {
      // Delete all chat messages for this project
      const { error: deleteError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("project_id", projectId);

      if (deleteError) throw deleteError;

      // Reset project data
      const { error: updateError } = await supabase
        .from("projects")
        .update({
          current_index: 0,
          drilling_path_data: null,
          meters_drilled: 0,
          current_image_url: null,
          precision_improvement: 0,
          image_quality: 40,
        })
        .eq("id", projectId);

      if (updateError) throw updateError;

      toast.success("Drilling reset! Ready to start from beginning.");
      setMessages([]);
      setDebugEntries([]);
      fetchProject();
    } catch (error: any) {
      console.error('Reset error:', error);
      toast.error(error.message || "Failed to reset drilling");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartPolling = async () => {
    if (!project?.external_api_url) {
      toast.error("Please configure API URL first");
      setShowApiConfig(true);
      return;
    }

    if (project.polling_active) {
      toast.error("Polling is already active");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke("poll-external-api", {
        body: {
          projectId,
          iterations: 20,
        },
      });

      if (error) throw error;

      toast.success("Polling started! Check messages for updates.");
    } catch (error: any) {
      console.error('Polling error:', error);
      toast.error(error.message || "Failed to start polling");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopPolling = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ polling_active: false })
        .eq("id", projectId);

      if (error) throw error;

      toast.success("Drilling stopped!");
      fetchProject();
    } catch (error: any) {
      console.error('Stop error:', error);
      toast.error(error.message || "Failed to stop drilling");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-lg">{project?.name}</h1>
            {project && (
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="text-success">{project.meters_drilled}m drilled</span>
                <span className="text-primary">+{project.precision_improvement}% precision</span>
                <span>{project.image_quality}% quality</span>
                <span className="text-muted-foreground">Index: {project.current_index}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowApiConfig(!showApiConfig)}
            disabled={isLoading}
          >
            {project?.external_api_url ? "API Configured ✓" : "Configure API"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestartDrilling}
            disabled={isLoading || project?.polling_active}
          >
            Clear
          </Button>
          {project?.polling_active ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStopPolling}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Stop Drilling
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleStartPolling}
              disabled={isLoading || !project?.external_api_url}
            >
              Start Drilling Simulation
            </Button>
          )}
        </div>
      </header>

      {/* API Configuration Card */}
      {showApiConfig && (
        <div className="px-4 py-3 bg-muted/50 border-b border-border">
          <Card className="p-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">External API URL (domain only)</label>
                <p className="text-xs text-muted-foreground mb-2">
                  Enter the base domain (e.g., https://example.com)
                </p>
                <Input
                  placeholder="https://8917d9e1ffac.ngrok-free.app"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="mb-2"
                />
                <p className="text-xs font-mono text-muted-foreground mt-1">
                  GET /drilling-data?index=N
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveApiUrl} size="sm">
                  Save API URL
                </Button>
                <Button variant="ghost" onClick={() => setShowApiConfig(false)} size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Chat Section */}
        <div className="w-1/2 flex flex-col border-r border-border">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <Card className="p-6 border-border bg-card/50 backdrop-blur-sm">
                <p className="text-muted-foreground text-center">
                  Start by uploading a seismogram image or asking a question about your drilling
                  project.
                </p>
              </Card>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <Card
                  className={`max-w-[80%] p-4 ${
                    message.role === "user"
                      ? "bg-primary/10 border-primary/20"
                      : "bg-card/50 border-border"
                  }`}
                >
                  {message.image_url && (
                    <img 
                      src={message.image_url} 
                      alt="Seismogram" 
                      className="w-full rounded-md mb-2 max-h-64 object-cover"
                    />
                  )}
                  <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-code:text-foreground">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                </Card>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <Card className="p-4 bg-card/50 border-border">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </Card>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-border bg-card/50 backdrop-blur-sm">
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleFileUpload}
                className="border-border hover:bg-muted"
              >
                <Upload className="h-4 w-4" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Ask about seismogram analysis, drilling path..."
                className="bg-input border-border"
                disabled={isLoading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-primary hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Visualization Section */}
        <div className="w-1/2 bg-muted/20">
          <DrillingCanvas projectId={projectId || ""} />
        </div>
      </div>

      {/* Debug Panel */}
      <DebugPanel debugEntries={debugEntries} systemPrompt={systemPrompt} />
    </div>
  );
};

export default Workspace;
