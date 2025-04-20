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
import { Send, Trash2 } from "lucide-react";
import Markdown from "markdown-to-jsx";
import { FormEvent, useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string | { type: string; text: string }[];
};

const getContent = (message: Message) => {
  if (typeof message.content === "string") {
    return message.content;
  }
  return message.content.map((item) => item.text).join("");
};

export default function PlannerPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Reference for auto-scrolling to bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Function to determine if a message should be displayed as an assistant message
  const isDisplayedAsAssistant = (message: Message) => {
    // Check if it's already an assistant message
    if (message.role === "assistant") return true;

    // Check if it matches the tool ID pattern
    const toolIdPattern = /^\[\w+: ToolId: \d+\]/;
    return toolIdPattern.test(getContent(message));
  };
  // Start streaming messages when component mounts
  useEffect(() => {
    let eventSource: EventSource;

    const startStreaming = () => {
      setIsLoading(true);
      eventSource = new EventSource("/api/planner/stream");

      // Listen for the 'connected' event
      eventSource.addEventListener("connected", () => {
        console.log("Connected to event stream");
        setIsConnected(true);
        setIsLoading(false);
      });

      // Listen for the 'messages' event
      eventSource.addEventListener("messages", (event) => {
        try {
          const newMessages = JSON.parse(event.data) as Message[];
          setMessages(newMessages);
          setIsLoading(false);
        } catch (err) {
          console.error("Error parsing messages:", err);
        }
      });

      // Handle all errors
      eventSource.onerror = () => {
        console.error("EventSource error");
        setError(new Error("Connection error. Please try again."));
        setIsLoading(false);
        setIsConnected(false);
        eventSource.close();
        // Try to reconnect after a delay
        setTimeout(startStreaming, 5000);
      };
    };

    startStreaming();

    // Cleanup function
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content: input.trim(),
    };

    // Add user message to UI immediately
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Send message to the endpoint
      const response = await fetch("/api/planner/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userMessage.content }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      // Note: We don't need to handle the response here as the stream will receive the assistant's reply
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("An unknown error occurred")
      );
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (isClearing || messages.length === 0) return;

    setIsClearing(true);
    setError(null);

    try {
      const response = await fetch("/api/planner/clear", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear message history");
      }

      // Clear messages locally immediately
      setMessages([]);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("An unknown error occurred")
      );
    } finally {
      setIsClearing(false);
    }
  };

  console.log(messages);

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-73px)]">
      <Card className="flex-1 flex flex-col shadow-none border-0 rounded-none">
        <CardHeader className="pb-4 border-b bg-zinc-50 dark:bg-zinc-900 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center">
            AI Planner Assistant
            {isConnected && (
              <span className="ml-2 text-xs text-green-500">(Connected)</span>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHistory}
            disabled={isClearing || messages.length === 0}
            className="flex items-center gap-1"
          >
            <Trash2 className="h-4 w-4" />
            Clear History
          </Button>
        </CardHeader>

        <CardContent className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-6">
            {messages.map((message, index) => {
              const displayAsAssistant = isDisplayedAsAssistant(message);

              return (
                <div
                  key={index}
                  className={`flex items-start gap-3 ${
                    !displayAsAssistant ? "flex-row-reverse" : ""
                  }`}
                >
                  <Avatar
                    className={
                      !displayAsAssistant ? "bg-secondary" : "bg-primary"
                    }
                  >
                    <AvatarFallback>
                      {!displayAsAssistant ? "U" : "AI"}
                    </AvatarFallback>
                    {displayAsAssistant && (
                      <AvatarImage src="/ai-avatar.svg" alt="AI" />
                    )}
                  </Avatar>

                  <div
                    className={`p-4 rounded-lg max-w-[80%] ${
                      !displayAsAssistant
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    <div className="markdown-content">
                      <Markdown>{getContent(message)}</Markdown>
                    </div>
                  </div>
                </div>
              );
            })}

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
