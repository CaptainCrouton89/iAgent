"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Settings, Trash2 } from "lucide-react";
import Link from "next/link";
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

  // State for tracking streaming content
  const [streamingContent, setStreamingContent] = useState("");
  const [currentToolCalls, setCurrentToolCalls] = useState<Map<string, {
    toolName: string;
    args: string;
    result?: string;
  }>>(new Map());

  // Start streaming when component mounts
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

      // Listen for 'message' events (Server-Sent Events use 'data:' format)
      eventSource.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case "text-delta":
              setStreamingContent(prev => prev + data.textDelta);
              setIsLoading(false);
              break;

            case "tool-call-streaming-start":
              setCurrentToolCalls(prev => {
                const updated = new Map(prev);
                updated.set(data.toolCallId, {
                  toolName: data.toolName,
                  args: "",
                });
                return updated;
              });
              break;

            case "tool-call-delta":
              setCurrentToolCalls(prev => {
                const updated = new Map(prev);
                const existing = updated.get(data.toolCallId);
                if (existing) {
                  existing.args += data.argsTextDelta;
                }
                return updated;
              });
              break;

            case "tool-result":
              setCurrentToolCalls(prev => {
                const updated = new Map(prev);
                const existing = updated.get(data.toolCallId);
                if (existing) {
                  existing.result = data.result;
                }
                return updated;
              });
              break;

            case "finish":
              // Finalize the assistant message
              if (streamingContent || currentToolCalls.size > 0) {
                const contentItems = [];
                
                // Add text content if any
                if (streamingContent) {
                  contentItems.push({
                    type: "text" as const,
                    text: streamingContent,
                  });
                }
                
                // Add tool calls and results
                for (const [toolCallId, toolCall] of currentToolCalls) {
                  contentItems.push({
                    type: "tool-call" as const,
                    toolCallId,
                    toolName: toolCall.toolName,
                    args: toolCall.args ? JSON.parse(toolCall.args) : {},
                  });
                  
                  if (toolCall.result) {
                    contentItems.push({
                      type: "tool-result" as const,
                      toolCallId,
                      toolName: toolCall.toolName,
                      result: {
                        success: true,
                        data: toolCall.result,
                        type: "markdown" as const,
                      },
                    });
                  }
                }

                const assistantMessage: Message = {
                  id: Date.now().toString(),
                  role: "assistant",
                  content: contentItems,
                };

                setMessages(prev => [...prev, assistantMessage]);
              }
              
              // Reset streaming state
              setStreamingContent("");
              setCurrentToolCalls(new Map());
              setIsLoading(false);
              setIsConnected(true);
              break;
          }
        } catch (err) {
          console.error("Error parsing streaming data:", err);
        }
      });

      // Handle connection establishment
      eventSource.addEventListener("open", () => {
        console.log("Connected to event stream");
        setIsConnected(true);
        setIsLoading(false);
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

  // Scroll to bottom when messages or streaming content changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, currentToolCalls]);

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
        <div className="flex gap-2">
          <Link href="/private/configure-agents">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1 text-gray-600 border-gray-300 hover:bg-gray-100"
            >
              <Settings className="h-4 w-4" />
              Configure Agents
            </Button>
          </Link>
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

          {/* Show streaming content and tool calls in progress */}
          {(streamingContent || currentToolCalls.size > 0) && (
            <div className="flex items-start gap-3">
              <Avatar className="bg-blue-500 text-white">
                <AvatarFallback>AI</AvatarFallback>
                <AvatarImage src="/ai-avatar.svg" alt="AI" />
              </Avatar>
              <div className="bg-white border border-gray-200 shadow-sm p-4 rounded-lg max-w-[80%]">
                {/* Streaming text content */}
                {streamingContent && (
                  <div className="mb-3">
                    <div className="prose prose-sm max-w-none">
                      {streamingContent}
                      <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1"></span>
                    </div>
                  </div>
                )}
                
                {/* Tool calls in progress */}
                {Array.from(currentToolCalls.entries()).map(([toolCallId, toolCall]) => (
                  <div key={toolCallId} className="mb-3">
                    <div className="border border-gray-200 rounded-md overflow-hidden">
                      <div className="bg-blue-50 px-3 py-2 border-l-2 border-l-blue-500 font-medium text-sm text-blue-700">
                        Tool Call: {toolCall.toolName}
                        {!toolCall.result && <span className="ml-2 animate-pulse">●</span>}
                      </div>
                      {toolCall.args && (
                        <pre className="text-xs bg-white text-gray-800 p-3 m-0 overflow-x-auto border-t border-gray-200">
                          {toolCall.args}
                          {!toolCall.result && <span className="inline-block w-1 h-3 bg-blue-500 animate-pulse ml-1"></span>}
                        </pre>
                      )}
                      {toolCall.result && (
                        <div className="p-3 text-sm border-t border-gray-200 bg-green-50">
                          <div className="text-green-700 font-medium mb-1">Result:</div>
                          <div className="text-gray-800">{toolCall.result}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isLoading && !streamingContent && currentToolCalls.size === 0 && (
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
