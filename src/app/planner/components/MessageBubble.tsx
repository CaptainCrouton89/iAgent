import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Message } from "../types";
import {
  containsMultipleJsonObjects,
  extractJsonObjects,
} from "../utils/helpers";
import { MessageContent } from "./MessageContent";

interface MessageBubbleProps {
  message: Message;
  isAssistant: boolean;
}

export function MessageBubble({ message, isAssistant }: MessageBubbleProps) {
  // Check if this message contains JSON tool responses directly
  const hasJsonToolResponses =
    typeof message.content === "string" &&
    containsMultipleJsonObjects(message.content) &&
    extractJsonObjects(message.content).length > 0;

  // Use either the passed isAssistant prop or check for JSON tool responses
  const shouldDisplayAsAssistant = isAssistant || hasJsonToolResponses;

  return (
    <div
      className={`flex items-start gap-3 ${
        !shouldDisplayAsAssistant ? "flex-row-reverse" : ""
      }`}
    >
      <Avatar
        className={
          !shouldDisplayAsAssistant
            ? "bg-gray-100 text-gray-600 border border-gray-200"
            : "bg-blue-500 text-white"
        }
      >
        <AvatarFallback>
          {!shouldDisplayAsAssistant ? "U" : "AI"}
        </AvatarFallback>
        {shouldDisplayAsAssistant && (
          <AvatarImage src="/ai-avatar.svg" alt="AI" />
        )}
      </Avatar>

      <div
        className={`p-4 rounded-lg max-w-[80%] ${
          !shouldDisplayAsAssistant
            ? "bg-gray-100 text-gray-800"
            : "bg-white text-gray-800 border border-gray-200 shadow-sm"
        }`}
      >
        <MessageContent message={message} />
      </div>
    </div>
  );
}
