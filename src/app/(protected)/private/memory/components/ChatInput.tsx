import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormEvent, KeyboardEvent } from "react";

interface ChatInputProps {
  input: string;
  isReady: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function ChatInput({
  input,
  isReady,
  onInputChange,
  onSubmit,
}: ChatInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && input.trim()) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex w-full gap-2">
      <Textarea
        value={input}
        onChange={onInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Send a message... (Shift+Enter for new line)"
        disabled={!isReady}
        className="flex-1 min-h-[44px] max-h-[200px] resize-y"
        rows={1}
      />
      <Button type="submit" disabled={!isReady || !input.trim()}>
        Send
      </Button>
    </form>
  );
}
