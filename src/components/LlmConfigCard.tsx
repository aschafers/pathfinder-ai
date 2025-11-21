import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface LlmConfigCardProps {
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
}

const LlmConfigCard = ({
  systemPrompt,
  onSystemPromptChange,
  onSave,
  onCancel,
  onReset,
}: LlmConfigCardProps) => {
  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">System Prompt</label>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-8 text-xs"
            >
              Reset to Default
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Configure the system prompt that guides the LLM behavior
          </p>
          <Textarea
            placeholder="Enter system prompt..."
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange(e.target.value)}
            className="min-h-[300px] font-mono text-xs"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={onSave} size="sm">
            Save Configuration
          </Button>
          <Button variant="ghost" onClick={onCancel} size="sm">
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default LlmConfigCard;
