import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronUp, Terminal } from "lucide-react";

interface DebugEntry {
  timestamp: string;
  provider: string;
  model: string;
  prompt: string | any;
  systemPrompt: string;
  response: string;
  tokensUsed: string | number;
}

interface DebugPanelProps {
  debugEntries: DebugEntry[];
}

const DebugPanel = ({ debugEntries }: DebugPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);

  const formatPrompt = (prompt: any) => {
    if (typeof prompt === 'string') return prompt;
    if (Array.isArray(prompt)) {
      return prompt.map((item, idx) => {
        if (item.type === 'text') return item.text;
        if (item.type === 'image_url') return '[Image]';
        return JSON.stringify(item);
      }).join('\n');
    }
    return JSON.stringify(prompt);
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 bg-card border-border"
      >
        <Terminal className="h-4 w-4 mr-2" />
        Debug LLM
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-[600px] h-[500px] bg-card border-border shadow-lg flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">LLM Debug Panel</h3>
          <span className="text-xs text-muted-foreground">
            ({debugEntries.length} requêtes)
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="h-8 w-8 p-0"
        >
          ✕
        </Button>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {debugEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune requête LLM pour le moment
            </p>
          ) : (
            debugEntries.map((entry, idx) => (
              <Card
                key={idx}
                className="p-3 bg-muted/30 border-border cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedEntry(expandedEntry === idx ? null : idx)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
                      {entry.provider}
                    </span>
                  </div>
                  {expandedEntry === idx ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>

                <div className="text-xs space-y-1">
                  <div>
                    <span className="font-semibold">Model:</span>{" "}
                    <span className="font-mono">{entry.model}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Tokens:</span>{" "}
                    <span className="font-mono">{entry.tokensUsed}</span>
                  </div>
                </div>

                {expandedEntry === idx && (
                  <div className="mt-3 space-y-3 text-xs">
                    <div>
                      <div className="font-semibold mb-1 text-primary">System Prompt:</div>
                      <pre className="bg-background p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                        {entry.systemPrompt.substring(0, 200)}...
                      </pre>
                    </div>

                    <div>
                      <div className="font-semibold mb-1 text-primary">User Prompt:</div>
                      <pre className="bg-background p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                        {formatPrompt(entry.prompt)}
                      </pre>
                    </div>

                    <div>
                      <div className="font-semibold mb-1 text-primary">Response:</div>
                      <pre className="bg-background p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                        {entry.response}
                      </pre>
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};

export default DebugPanel;
