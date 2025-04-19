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
import { useChat } from "@ai-sdk/react";
import { Send } from "lucide-react";
import { FormEvent, useRef } from "react";

export default function PlannerPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
      api: "/api/planner",
      id: "planner",
    });

  // Reference for auto-scrolling to bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom when messages change
  if (typeof window !== "undefined") {
    setTimeout(scrollToBottom, 100);
  }

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    handleSubmit(e);
  };

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-73px)]">
      <Card className="flex-1 flex flex-col shadow-none border-0 rounded-none">
        <CardHeader className="pb-4 border-b bg-zinc-50 dark:bg-zinc-900">
          <CardTitle className="text-xl font-bold">
            AI Planner Assistant
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 p-6 overflow-y-auto">
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

            {error && (
              <div className="p-4 bg-red-100 text-red-700 rounded-lg">
                Error: {error.message}
              </div>
            )}

            {messages.length === 0 && !isLoading && (
              <div className="py-20 text-center text-muted-foreground">
                <p className="text-lg mb-2">
                  Welcome to the AI Planner Assistant!
                </p>
                <p>
                  Start planning by typing a message like &ldquo;Help me plan my
                  week&rdquo; or &ldquo;I need to organize a project&rdquo;.
                </p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </CardContent>

        <CardFooter className="p-4 border-t">
          <form onSubmit={handleFormSubmit} className="flex w-full gap-2">
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
