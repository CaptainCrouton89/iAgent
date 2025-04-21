"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AgentSelector } from "./components/AgentSelector";
import { MessageBubble } from "./components/MessageBubble";
import "./markdown.css";
import { Message } from "./types";
import {
  containsMultipleJsonObjects,
  extractJsonObjects,
  isDisplayedAsAssistant,
  normalizeEventData,
  parseJsonArray,
} from "./utils/helpers";

export default function PlannerPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  // Reference for auto-scrolling to bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Start streaming messages when component mounts
  useEffect(() => {
    let eventSource: EventSource;

    const startStreaming = () => {
      setIsLoading(true);
      // Don't start streaming if no agent is selected
      if (!selectedAgentId) {
        setIsLoading(false);
        return;
      }

      eventSource = new EventSource(
        `/api/agents/stream?agentId=${selectedAgentId}`
      );

      // Listen for the 'connected' event
      eventSource.addEventListener("connected", () => {
        console.log("Connected to event stream");
        setIsConnected(true);
        setIsLoading(false);
      });

      // Listen for the 'messages' event
      eventSource.addEventListener("messages", (event) => {
        try {
          // Normalize the event data (removing "data:" prefix if present)
          const normalizedData = normalizeEventData(event.data);

          // Parse the messages array
          const parsedMessages = JSON.parse(normalizedData) as Message[];

          // Process each message to handle JSON tool responses
          const processedMessages = parsedMessages.map((message) => {
            if (
              message.role === "user" &&
              typeof message.content === "string"
            ) {
              const trimmedContent = message.content.trim();

              // Check if the content is a JSON array of tool responses
              if (parseJsonArray(trimmedContent).length > 0) {
                console.log("Found JSON array tool responses");
                // We don't modify the original message but the MessageBubble component
                // will use isDisplayedAsAssistant to determine how to display it
              }
              // Check for embedded JSON objects
              else if (containsMultipleJsonObjects(trimmedContent)) {
                // Check if we have valid tool responses in the content
                const jsonResponses = extractJsonObjects(trimmedContent);
                if (jsonResponses.length > 0) {
                  console.log(
                    "Found JSON tool responses in user message:",
                    jsonResponses.length
                  );
                  // We don't modify the original message but the MessageBubble component
                  // will use isDisplayedAsAssistant to determine how to display it
                }
              }
            }
            return message;
          });

          setMessages(processedMessages);
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
  }, [selectedAgentId]);

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
      const response = await fetch("/api/agents/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          agentId: selectedAgentId,
        }),
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
      const response = await fetch(
        `/api/agents/clear?agentId=${selectedAgentId}`,
        {
          method: "DELETE",
        }
      );

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

  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-h-0 container mx-auto">
      <div className="flex flex-row items-center justify-between border-b p-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-800">
            AI Planner Assistant
            {isConnected && (
              <span className="ml-2 text-xs text-green-500">(Connected)</span>
            )}
          </h1>
          <AgentSelector
            selectedAgentId={selectedAgentId}
            onAgentChange={setSelectedAgentId}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearHistory}
          disabled={isClearing || messages.length === 0}
          className="flex items-center gap-1 text-gray-600 border-gray-300 hover:bg-gray-100"
        >
          <Trash2 className="h-4 w-4" />
          Clear History
        </Button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
        <div className="space-y-6">
          {messages.map((message, index) => (
            <MessageBubble
              key={index}
              message={message}
              isAssistant={isDisplayedAsAssistant(message)}
            />
          ))}

          {isLoading && (
            <div className="flex items-start gap-3">
              <Avatar className="bg-blue-500 text-white">
                <AvatarFallback>AI</AvatarFallback>
                <AvatarImage src="/ai-avatar.svg" alt="AI" />
              </Avatar>
              <div className="bg-white border border-gray-200 shadow-sm p-4 rounded-lg max-w-[80%]">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-bounce"></div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
              Error: {error.message}
            </div>
          )}

          {messages.length === 0 && !isLoading && (
            <div className="py-20 text-center text-gray-500">
              <p className="text-lg mb-2 font-medium">
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
      </div>

      <div className="p-4 border-t">
        <form onSubmit={handleFormSubmit} className="flex w-full gap-2">
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={handleInputChange}
            className="flex-1 border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            disabled={isLoading || !selectedAgentId}
          />
          <Button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white"
            disabled={isLoading || !input.trim() || !selectedAgentId}
          >
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
