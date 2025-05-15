import { Message } from "@ai-sdk/react";
import { EditableMessage } from "./EditableMessage";

interface ChatContainerProps {
  messages: Message[];
  isLoading: boolean;
  onEditMessage: (messageId: string, newContent: string) => void;
  currentEmotion: string;
}

export function ChatContainer({
  messages,
  isLoading,
  onEditMessage,
  currentEmotion,
}: ChatContainerProps) {
  return (
    <div className="flex-1 overflow-auto space-y-4 min-h-[300px]">
      {messages.map((message) => (
        <EditableMessage
          key={message.id}
          message={message}
          onEdit={onEditMessage}
          currentEmotion={currentEmotion}
        />
      ))}
      {isLoading && messages.length === 0 && (
        <div className="flex justify-center items-center h-full">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      )}
    </div>
  );
}
