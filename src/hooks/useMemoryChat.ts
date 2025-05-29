"use client";

import {
  ChatRequestBody,
  ChatStatus,
  Message,
  StreamEvent,
  ToolInvocation,
} from "@/types/chat";
import { useCallback, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

interface UseChatOptions {
  api: string;
}

export function useMemoryChat({ api }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<string | null>(null);

  // Track ongoing tool calls
  const toolCallsRef = useRef<Map<string, ToolInvocation>>(new Map());
  const currentAssistantMessageRef = useRef<string>("");

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  const processStreamEvent = useCallback(
    (event: StreamEvent, currentMessageId: string) => {
      console.log("Processing stream event:", event.type, event);

      // Debug: Log all event types we receive
      if (!["text-delta", "finish"].includes(event.type)) {
        console.log("🔧 Non-text event received:", event.type, event);
      }

      switch (event.type) {
        case "text-delta":
          if (event.textDelta) {
            currentAssistantMessageRef.current += event.textDelta;

            setMessages((prev) => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];

              if (
                lastMessage &&
                lastMessage.id === currentMessageId &&
                lastMessage.role === "assistant"
              ) {
                // Update existing assistant message
                lastMessage.content = currentAssistantMessageRef.current;
                if (!lastMessage.parts) lastMessage.parts = [];

                console.log(
                  "Current message parts before text update:",
                  lastMessage.parts
                );
                console.log(
                  "Current accumulated text:",
                  currentAssistantMessageRef.current
                );

                // Find existing text part or add new one
                const textPartIndex = lastMessage.parts.findIndex(
                  (p) => p.type === "text"
                );
                if (textPartIndex >= 0) {
                  // Update existing text part
                  const textPart = lastMessage.parts[textPartIndex];
                  if (textPart.type === "text") {
                    textPart.text = currentAssistantMessageRef.current;
                  }
                } else {
                  // Add new text part at the beginning (to preserve tool invocations)
                  lastMessage.parts.unshift({
                    type: "text",
                    text: currentAssistantMessageRef.current,
                  });
                }

                console.log(
                  "Message parts after text update:",
                  lastMessage.parts
                );
              } else {
                // Create new assistant message
                newMessages.push({
                  id: currentMessageId,
                  role: "assistant",
                  content: currentAssistantMessageRef.current,
                  parts: [
                    { type: "text", text: currentAssistantMessageRef.current },
                  ],
                  createdAt: new Date(),
                });
              }

              return newMessages;
            });
          }
          break;

        case "tool-call-streaming-start":
          if (event.toolCallId && event.toolName) {
            // Store accumulator string in the ref, but empty object in message
            const toolInvocation = {
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              state: "partial-call" as const,
              args: {}, // Empty object for display
              argsString: "", // Track string accumulation separately
            };
            toolCallsRef.current.set(event.toolCallId, toolInvocation);

            console.log(
              "Starting tool call:",
              event.toolName,
              event.toolCallId
            );

            setMessages((prev) => {
              const newMessages = [...prev];
              let lastMessage = newMessages[newMessages.length - 1];

              // Create assistant message if it doesn't exist yet
              if (
                !lastMessage ||
                lastMessage.id !== currentMessageId ||
                lastMessage.role !== "assistant"
              ) {
                console.log("Creating new assistant message for tool call");
                lastMessage = {
                  id: currentMessageId,
                  role: "assistant",
                  content: "",
                  parts: [],
                  createdAt: new Date(),
                };
                newMessages.push(lastMessage);
              }

              if (!lastMessage.parts) lastMessage.parts = [];
              // Add tool invocation without the argsString property
              lastMessage.parts.push({
                type: "tool-invocation",
                toolInvocation: {
                  toolCallId: event.toolCallId || "",
                  toolName: event.toolName || "",
                  state: "partial-call",
                  args: {},
                },
              });

              console.log(
                "Added tool invocation to message parts:",
                lastMessage.parts
              );

              return newMessages;
            });
          }
          break;

        case "tool-call-delta":
          if (event.toolCallId && event.argsTextDelta) {
            const toolCall = toolCallsRef.current.get(event.toolCallId);
            if (toolCall && "argsString" in toolCall) {
              // Accumulate args string
              toolCall.argsString =
                (toolCall.argsString || "") + event.argsTextDelta;

              // Try to parse the accumulated string
              try {
                const parsedArgs = JSON.parse(toolCall.argsString as string);
                toolCall.args = parsedArgs;

                // Update in the message parts with parsed args
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];

                  if (
                    lastMessage &&
                    lastMessage.role === "assistant" &&
                    lastMessage.parts
                  ) {
                    const toolPart = lastMessage.parts.find(
                      (part) =>
                        part.type === "tool-invocation" &&
                        part.toolInvocation.toolCallId === event.toolCallId
                    );

                    if (toolPart && toolPart.type === "tool-invocation") {
                      toolPart.toolInvocation.args = parsedArgs;
                      toolPart.toolInvocation.state = "call";
                    }
                  }

                  return newMessages;
                });
              } catch {
                // Not valid JSON yet, keep accumulating
                // Don't update message parts until we have valid JSON
              }
            }
          }
          break;

        case "tool-call-complete":
          if (event.toolCallId && event.args) {
            const toolCall = toolCallsRef.current.get(event.toolCallId);
            if (toolCall) {
              // Set properly parsed args from backend
              toolCall.args = event.args;
              toolCall.state = "call";

              console.log(
                "Tool call complete with parsed args:",
                event.toolCallId,
                event.args
              );

              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];

                if (
                  lastMessage &&
                  lastMessage.role === "assistant" &&
                  lastMessage.parts
                ) {
                  const toolPart = lastMessage.parts.find(
                    (part) =>
                      part.type === "tool-invocation" &&
                      part.toolInvocation.toolCallId === event.toolCallId
                  );

                  if (toolPart && toolPart.type === "tool-invocation") {
                    toolPart.toolInvocation.args = event.args;
                    toolPart.toolInvocation.state = "call";
                  }
                }

                return newMessages;
              });
            }
          }
          break;

        case "tool-result":
          if (event.toolCallId && event.result) {
            const toolCall = toolCallsRef.current.get(event.toolCallId);
            if (toolCall) {
              // Ensure args are properly parsed from accumulated string
              if ("argsString" in toolCall && toolCall.argsString) {
                try {
                  toolCall.args = JSON.parse(toolCall.argsString as string);
                } catch (e) {
                  console.error(
                    "Failed to parse tool args:",
                    toolCall.argsString,
                    e
                  );
                  toolCall.args = {};
                }
              }

              toolCall.result = event.result;
              toolCall.state = "result" as const;

              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];

                if (
                  lastMessage &&
                  lastMessage.role === "assistant" &&
                  lastMessage.parts
                ) {
                  // Find and update the tool invocation in the parts
                  const toolPart = lastMessage.parts.find(
                    (part) =>
                      part.type === "tool-invocation" &&
                      part.toolInvocation.toolCallId === event.toolCallId
                  );

                  if (toolPart && toolPart.type === "tool-invocation") {
                    toolPart.toolInvocation.result = event.result;
                    toolPart.toolInvocation.state = "result";
                    // Ensure args are the parsed object
                    if (toolCall.args && typeof toolCall.args === "object") {
                      toolPart.toolInvocation.args = toolCall.args;
                    }
                  }
                }

                return newMessages;
              });
            }
          }
          break;

        case "finish":
          // Finalize the current message before resetting
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];

            if (
              lastMessage &&
              lastMessage.id === currentMessageId &&
              lastMessage.role === "assistant"
            ) {
              // Ensure the final text is properly stored in the message content and parts
              lastMessage.content = currentAssistantMessageRef.current;
              if (lastMessage.parts) {
                const textPartIndex = lastMessage.parts.findIndex(
                  (p) => p.type === "text"
                );
                if (textPartIndex >= 0) {
                  const textPart = lastMessage.parts[textPartIndex];
                  if (textPart.type === "text") {
                    textPart.text = currentAssistantMessageRef.current;
                  }
                } else if (currentAssistantMessageRef.current) {
                  // Add text part if it doesn't exist but we have text
                  lastMessage.parts.push({
                    type: "text",
                    text: currentAssistantMessageRef.current,
                  });
                }
              }
            }

            return newMessages;
          });

          // Reset for next message
          currentAssistantMessageRef.current = "";
          toolCallsRef.current.clear();
          setStatus("ready");
          break;

        case "error":
          setError(event.error || "An error occurred");
          setStatus("error");
          break;
      }
    },
    []
  );

  const append = useCallback(
    async (message: Message, options?: { body?: Partial<ChatRequestBody> }) => {
      setStatus("loading");
      setError(null);

      const newMessage = {
        ...message,
        id: message.id || uuidv4(),
        createdAt: message.createdAt || new Date(),
      };

      // Add user message immediately
      setMessages((prev) => [...prev, newMessage]);

      // Prepare request body
      const requestBody: ChatRequestBody = {
        messages: [...messages, newMessage],
        ...options?.body,
      };

      try {
        const response = await fetch(api, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Create assistant message ID for this response
        const assistantMessageId = uuidv4();
        currentAssistantMessageRef.current = "";

        // Process SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data.trim()) {
                try {
                  const event: StreamEvent = JSON.parse(data);
                  processStreamEvent(event, assistantMessageId);
                } catch (e) {
                  console.error("Error parsing SSE event:", e, data);
                }
              }
            }
          }
        }

        setStatus("ready");
      } catch (err) {
        console.error("Chat error:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
        setStatus("error");
      }
    },
    [messages, api, processStreamEvent]
  );

  const reload = useCallback(
    async (options?: { body?: Partial<ChatRequestBody> }) => {
      if (messages.length === 0) return;

      // Find the last user message
      let lastUserIndex = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          lastUserIndex = i;
          break;
        }
      }

      if (lastUserIndex === -1) return;

      // Remove all messages after the last user message
      const messagesToKeep = messages.slice(0, lastUserIndex + 1);
      setMessages(messagesToKeep);

      // Re-send the last user message
      const lastUserMessage = messages[lastUserIndex];
      await append(lastUserMessage, options);
    },
    [messages, append]
  );

  return {
    messages,
    input,
    handleInputChange,
    append,
    status,
    error,
    setMessages,
    reload,
    setInput,
  };
}
