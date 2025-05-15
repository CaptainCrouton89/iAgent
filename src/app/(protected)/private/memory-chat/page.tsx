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
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: originalHandleSubmit,
    status,
  } = useChat({
    api: "/api/memory-chat",
    maxSteps: 5,
    async onToolCall({ toolCall }) {
      if (toolCall.toolName === "getSystemInfo") {
        const args = toolCall.args as SystemInfoArgs;
        return `Custom client-side system info for ${args.type}`;
      }
    },
  });

  const handleSubmitWithEmotion = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    let currentEmotion = "Neutral";
    if (messages.length > 0) {
      try {
        const emotionResponse = await fetch("/api/ai/emotion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
        });
        if (emotionResponse.ok) {
          const emotionData = await emotionResponse.json();
          currentEmotion = emotionData.emotion || "Neutral";
        } else {
          console.error(
            "Failed to fetch emotion:",
            await emotionResponse.text()
          );
        }
      } catch (error) {
        console.error("Error fetching emotion:", error);
      }
    }

    originalHandleSubmit(event, { body: { currentEmotion } });
  };

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
            onSubmit={handleSubmitWithEmotion}
          />
        </CardFooter>
      </Card>
    </div>
  );
}
