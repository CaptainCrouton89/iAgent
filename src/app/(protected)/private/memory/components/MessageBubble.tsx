import { Message } from "@/types/chat";
import Markdown from "markdown-to-jsx";
import { ToolResponse } from "./ToolResponse";

interface MessageBubbleProps {
  message: Message;
}

const markdownOptions = {
  disableParsingRawHTML: true,
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const renderContent = () => {
    if (message.parts && message.parts.length > 0) {
      return message.parts.map((part, i) => {
        if (part.type === "text") {
          return (
            <div key={i} className="markdown-content">
              <Markdown options={markdownOptions}>{part.text}</Markdown>
            </div>
          );
        }

        if (part.type === "tool-invocation") {
          return <ToolResponse key={i} toolInvocation={part.toolInvocation} />;
        }

        return null;
      });
    }

    // Fallback to content if no parts
    if (message.content) {
      return (
        <div className="markdown-content">
          <Markdown options={markdownOptions}>{message.content}</Markdown>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className={`flex ${
        message.role === "user" ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[80%] md:max-w-[70%] px-4 py-2 rounded-lg ${
          message.role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        {renderContent()}
      </div>
    </div>
  );
}
