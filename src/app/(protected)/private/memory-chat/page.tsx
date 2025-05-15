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
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50 container mx-auto">
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b p-4">
          <CardTitle>Memory Chat</CardTitle>
          <SaveConversationButton messages={messages} />
        </CardHeader>
        <CardContent className="flex-1 p-6 overflow-y-auto bg-gray-50">
          <ChatContainer messages={messages} isLoading={status !== "ready"} />
        </CardContent>
        <CardFooter className="p-4 border-t">
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
