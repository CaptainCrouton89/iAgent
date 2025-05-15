import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormEvent } from "react";

interface ChatInputProps {
  input: string;
  isReady: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function ChatInput({
  input,
  isReady,
  onInputChange,
  onSubmit,
}: ChatInputProps) {
  return (
    <form onSubmit={onSubmit} className="flex w-full gap-2">
      <Input
        value={input}
        onChange={onInputChange}
        placeholder="Send a message..."
        disabled={!isReady}
        className="flex-1"
      />
      <Button type="submit" disabled={!isReady || !input.trim()}>
        Send
      </Button>
    </form>
  );
}
