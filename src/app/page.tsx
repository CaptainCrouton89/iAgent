"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { FormEvent, useCallback, useState } from "react";

// Custom types for our chat application
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Custom hook to handle chat functionality
function useCustomChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      // Add user message to chat
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: input.trim(),
      };

      setMessages((messages) => [...messages, userMessage]);
      setInput("");
      setIsLoading(true);

      try {
        // Format messages for the API
        const apiMessages = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        // Add the new user message
        apiMessages.push({
          role: "user",
          content: userMessage.content,
        });

        // Call our API
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messages: apiMessages }),
        });

        if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();

        // Add assistant response to chat
        setMessages((messages) => [
          ...messages,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: data.text,
          },
        ]);
      } catch (error) {
        console.error("Error sending message:", error);
        // Optionally add an error message to the chat
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages]
  );

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
  };
}

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useCustomChat();

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="pb-4 border-b">
          <CardTitle className="text-xl font-bold text-center">
            AI Chat Assistant
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6 h-[60vh] overflow-y-auto">
          <div className="space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <Avatar
                  className={
                    message.role === "user" ? "bg-secondary" : "bg-primary"
                  }
                >
                  <AvatarFallback>
                    {message.role === "user" ? "U" : "AI"}
                  </AvatarFallback>
                  {message.role !== "user" && (
                    <AvatarImage src="/ai-avatar.svg" alt="AI" />
                  )}
                </Avatar>

                <div
                  className={`p-4 rounded-lg max-w-[80%] ${
                    message.role === "user"
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-3">
                <Avatar className="bg-primary">
                  <AvatarFallback>AI</AvatarFallback>
                  <AvatarImage src="/ai-avatar.svg" alt="AI" />
                </Avatar>
                <div className="bg-primary text-primary-foreground p-4 rounded-lg max-w-[80%]">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-white animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="h-2 w-2 rounded-full bg-white animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="h-2 w-2 rounded-full bg-white animate-bounce"></div>
                  </div>
                </div>
              </div>
            )}

            {messages.length === 0 && !isLoading && (
              <div className="py-20 text-center text-muted-foreground">
                <p className="text-lg mb-2">
                  Welcome to the AI Chat Assistant!
                </p>
                <p>Start a conversation by typing a message below.</p>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="p-4 border-t">
          <form onSubmit={handleSubmit} className="flex w-full gap-2">
            <Input
              placeholder="Type your message..."
              value={input}
              onChange={handleInputChange}
              className="flex-1"
              disabled={isLoading}
            />
            <Button
              type="submit"
              variant="default"
              disabled={isLoading || !input.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
