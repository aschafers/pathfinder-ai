import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Send, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import DrillingCanvas from "@/components/DrillingCanvas";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url?: string;
}

interface Project {
  id: string;
  name: string;
  meters_drilled: number;
  precision_improvement: number;
  image_quality: number;
  initial_image_url?: string;
  current_image_url?: string;
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

  useEffect(() => {
    fetchProject();
    fetchMessages();
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      
      const typedAiMsg: Message = {
        id: aiMsg.id,
        role: aiMsg.role as "assistant",
        content: aiMsg.content,
        image_url: aiMsg.image_url || undefined,
      };
      setMessages((prev) => [...prev, typedAiMsg]);

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
      
      const typedAiMsg: Message = {
        id: aiMsg.id,
        role: aiMsg.role as "assistant",
        content: aiMsg.content,
        image_url: aiMsg.image_url || undefined,
      };
      setMessages((prev) => [...prev, typedAiMsg]);

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
              </div>
            )}
          </div>
        </div>
      </header>

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
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
    </div>
  );
};

export default Workspace;
