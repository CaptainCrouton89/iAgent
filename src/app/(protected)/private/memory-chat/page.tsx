"use client";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useChat } from "@ai-sdk/react";
import { ChatContainer, ChatInput, SaveConversationButton } from "./components";

interface SystemInfoArgs {
  type: string;
}

export default function MemoryChatPage() {
  const { messages, input, handleInputChange, handleSubmit, status } = useChat({
    api: "/api/memory-chat",
    maxSteps: 5, // Enable multi-step tool usage
    async onToolCall({ toolCall }) {
      // Handle client-side tools here if needed
      if (toolCall.toolName === "getSystemInfo") {
        // If we want to handle this on the client side instead
        const args = toolCall.args as SystemInfoArgs;
        return `Custom client-side system info for ${args.type}`;
      }
    },
  });

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full p-4">
      <Card className="flex-1 flex flex-col mx-auto w-full max-w-6xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Memory Chat</CardTitle>
          <SaveConversationButton messages={messages} />
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ChatContainer messages={messages} isLoading={status !== "ready"} />
        </CardContent>
        <CardFooter>
          <ChatInput
            input={input}
            isReady={status === "ready"}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
          />
        </CardFooter>
      </Card>
    </div>
  );
}
