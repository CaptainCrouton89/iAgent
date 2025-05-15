import { Message } from "@ai-sdk/react";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
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
        {message.parts &&
          message.parts.map((part, i) => {
            if (part.type === "text") {
              return (
                <div key={i} className="whitespace-pre-wrap">
                  {part.text}
                </div>
              );
            }

            // if (part.type === "tool-invocation") {
            //   return (
            //     <ToolResponse key={i} toolInvocation={part.toolInvocation} />
            //   );
            // }

            return null;
          })}
      </div>
    </div>
  );
}
