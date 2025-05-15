import { Message } from "@ai-sdk/react";
import { MessageBubble } from "./MessageBubble";

interface ChatContainerProps {
  messages: Message[];
  isLoading: boolean;
}

export function ChatContainer({ messages, isLoading }: ChatContainerProps) {
  return (
    <div className="flex-1 overflow-auto space-y-4 h-[calc(100%-8rem)] min-h-[300px]">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {isLoading && messages.length === 0 && (
        <div className="flex justify-center items-center h-full">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      )}
    </div>
  );
}
