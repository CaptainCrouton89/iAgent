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

interface MessageState {
  messages: Message[];
  currentAssistantId: string;
  currentTextContent: string;
  activeToolCalls: Map<string, ToolInvocation>;
}

export function useMemoryChat({ api }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<string | null>(null);

  // Use a single ref to track the current message state
  const messageStateRef = useRef<MessageState>({
    messages: [],
    currentAssistantId: "",
    currentTextContent: "",
    activeToolCalls: new Map(),
  });

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  const updateAssistantMessage = useCallback((newState: Partial<MessageState>) => {
    messageStateRef.current = { ...messageStateRef.current, ...newState };
    
    setMessages(prev => {
      const newMessages = [...prev];
      const currentId = messageStateRef.current.currentAssistantId;
      
      // Find existing assistant message or create new one
      let assistantMessage = newMessages.find(m => m.id === currentId && m.role === "assistant");
      
      if (!assistantMessage) {
        assistantMessage = {
          id: currentId,
          role: "assistant",
          content: "",
          parts: [],
          createdAt: new Date(),
        };
        newMessages.push(assistantMessage);
      }

      // Update message content and parts
      assistantMessage.content = messageStateRef.current.currentTextContent;
      
      // Rebuild parts from current state
      const parts: Message["parts"] = [];
      
      // Add text part if there's content
      if (messageStateRef.current.currentTextContent) {
        parts.push({
          type: "text",
          text: messageStateRef.current.currentTextContent,
        });
      }
      
      // Add tool invocation parts
      messageStateRef.current.activeToolCalls.forEach(toolInvocation => {
        parts.push({
          type: "tool-invocation",
          toolInvocation,
        });
      });
      
      assistantMessage.parts = parts;
      return newMessages;
    });
  }, []);

  const handleTextDelta = useCallback((textDelta: string) => {
    messageStateRef.current.currentTextContent += textDelta;
    updateAssistantMessage({});
  }, [updateAssistantMessage]);

  const handleToolCallStart = useCallback((toolCallId: string, toolName: string) => {
    const toolInvocation: ToolInvocation = {
      toolCallId,
      toolName,
      state: "partial-call",
      args: {},
    };
    
    messageStateRef.current.activeToolCalls.set(toolCallId, toolInvocation);
    updateAssistantMessage({});
  }, [updateAssistantMessage]);

  const handleToolCallDelta = useCallback((toolCallId: string, argsTextDelta: string) => {
    const toolCall = messageStateRef.current.activeToolCalls.get(toolCallId);
    if (!toolCall) return;

    // Build up args string (we store it temporarily in a special property)
    const toolCallWithArgs = toolCall as ToolInvocation & { _argsString?: string };
    const currentArgsString = toolCallWithArgs._argsString || "";
    const newArgsString = currentArgsString + argsTextDelta;
    toolCallWithArgs._argsString = newArgsString;

    // Try to parse complete JSON
    try {
      const parsedArgs = JSON.parse(newArgsString);
      toolCall.args = parsedArgs;
      toolCall.state = "call";
      updateAssistantMessage({});
    } catch {
      // Not complete JSON yet, keep accumulating
    }
  }, [updateAssistantMessage]);

  const handleToolCallComplete = useCallback((toolCallId: string, args: unknown) => {
    const toolCall = messageStateRef.current.activeToolCalls.get(toolCallId);
    if (!toolCall) return;

    toolCall.args = args;
    toolCall.state = "call";
    // Clean up temporary args string
    const toolCallWithArgs = toolCall as ToolInvocation & { _argsString?: string };
    delete toolCallWithArgs._argsString;
    updateAssistantMessage({});
  }, [updateAssistantMessage]);

  const handleToolResult = useCallback((toolCallId: string, result: unknown) => {
    const toolCall = messageStateRef.current.activeToolCalls.get(toolCallId);
    if (!toolCall) return;

    toolCall.result = result;
    toolCall.state = "result";
    updateAssistantMessage({});
  }, [updateAssistantMessage]);

  const handleFinish = useCallback(() => {
    // Final update to ensure all data is saved
    updateAssistantMessage({});
    
    // Reset state for next message
    messageStateRef.current = {
      messages: [],
      currentAssistantId: "",
      currentTextContent: "",
      activeToolCalls: new Map(),
    };
    
    setStatus("ready");
  }, [updateAssistantMessage]);

  const processStreamEvent = useCallback(
    (event: StreamEvent, currentMessageId: string) => {
      // Ensure we're working with the current message
      if (messageStateRef.current.currentAssistantId !== currentMessageId) {
        messageStateRef.current.currentAssistantId = currentMessageId;
        messageStateRef.current.currentTextContent = "";
        messageStateRef.current.activeToolCalls.clear();
      }

      switch (event.type) {
        case "text-delta":
          if (event.textDelta) {
            handleTextDelta(event.textDelta);
          }
          break;

        case "tool-call-streaming-start":
          if (event.toolCallId && event.toolName) {
            handleToolCallStart(event.toolCallId, event.toolName);
          }
          break;

        case "tool-call-delta":
          if (event.toolCallId && event.argsTextDelta) {
            handleToolCallDelta(event.toolCallId, event.argsTextDelta);
          }
          break;

        case "tool-call-complete":
          if (event.toolCallId && event.args) {
            handleToolCallComplete(event.toolCallId, event.args);
          }
          break;

        case "tool-result":
          if (event.toolCallId && event.result !== undefined) {
            handleToolResult(event.toolCallId, event.result);
          }
          break;

        case "finish":
          handleFinish();
          break;

        case "error":
          setError(event.error || "An error occurred");
          setStatus("error");
          break;
      }
    },
    [handleTextDelta, handleToolCallStart, handleToolCallDelta, handleToolCallComplete, handleToolResult, handleFinish]
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