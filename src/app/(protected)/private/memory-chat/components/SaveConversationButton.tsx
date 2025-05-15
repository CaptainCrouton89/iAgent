import { Button } from "@/components/ui/button";
import { Message } from "@ai-sdk/react";
import { BookmarkIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SaveConversationButtonProps {
  messages: Message[];
}

export function SaveConversationButton({
  messages,
}: SaveConversationButtonProps) {
  const [isSaving, setIsSaving] = useState(false);

  const saveConversation = async () => {
    if (messages.length === 0) {
      toast.warning("No conversation to save");
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/memory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save conversation");
      }

      toast.success("Conversation saved successfully");
    } catch (error) {
      console.error("Error saving conversation:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save conversation"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={saveConversation}
      disabled={isSaving || messages.length === 0}
      className="flex gap-2 items-center"
    >
      <BookmarkIcon className="h-4 w-4" />
      {isSaving ? "Saving..." : "Save Conversation"}
    </Button>
  );
}
