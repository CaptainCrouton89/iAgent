"use client";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMemoryChat } from "@/hooks/useMemoryChat";
import { Message } from "@/types/chat";
import { useCallback, useEffect, useState } from "react";
import { ChatContainer, ChatInput, SaveConversationButton } from "./components";

export default function MemoryChatPage() {
  const {
    messages,
    input,
    handleInputChange,
    append,
    status,
    setMessages,
    reload,
    setInput,
  } = useMemoryChat({
    api: "/api/memory-chat",
  });

  const [interactionLessons, setInteractionLessons] = useState<string[]>([]);
  const [emotionHistory, setEmotionHistory] = useState<string[]>([]);
  const [pendingConsciousThought, setPendingConsciousThought] = useState<{
    thought: string;
    forMessageId: string;
  } | null>(null);

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const response = await fetch("/api/assistant-settings");
        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data.interaction_lessons)) {
            setInteractionLessons(data.interaction_lessons);
            console.log(
              "Fetched interaction lessons:",
              data.interaction_lessons
            );
          }
        } else {
          console.error(
            "Failed to fetch assistant settings:",
            await response.text()
          );
        }
      } catch (error) {
        console.error("Error fetching assistant settings:", error);
      }
    };
    fetchLessons();
  }, []);

  const handleEditMessage = async (messageId: string, newContent: string) => {
    const messageIndex = messages.findIndex((msg) => msg.id === messageId);
    if (messageIndex === -1) return;

    // Construct the new list of messages: original messages up to the edited one,
    // then the updated user message. This truncates any subsequent messages.
    const messagesForReload: Message[] = [
      ...messages.slice(0, messageIndex),
      {
        ...messages[messageIndex],
        content: newContent,
        parts: [{ type: "text" as const, text: newContent }],
      },
    ];

    // Update the local messages state immediately to show the edit
    setMessages(messagesForReload);

    // Fetch current emotion state
    let newEmotion = "Neutral";
    try {
      const emotionResponse = await fetch("/api/ai/emotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesForReload,
          emotionHistory: emotionHistory.slice(0, messageIndex),
        }), // Use the updated messages for emotion detection
      });

      if (emotionResponse.ok) {
        const data = await emotionResponse.json();
        newEmotion = data.emotion || "Neutral";
        setEmotionHistory([...emotionHistory, newEmotion]);
      }
    } catch (error) {
      console.error("Error fetching emotion:", error);
    }

    // Trigger a new AI response using useChat's reload function.
    // This will send messagesForReload to the API and handle streaming.
    try {
      await reload({
        body: {
          currentEmotion: newEmotion,
          interactionLessons,
        },
      });
    } catch (error) {
      console.error("Error reloading chat after edit:", error);
      // Optionally, you could revert messages or show an error indicator here
    }
  };

  const handleSubmitWithEmotion = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!input) return;

      // Check if there's a pending conscious thought to inject
      let consciousThought = null;
      if (pendingConsciousThought?.thought) {
        consciousThought = pendingConsciousThought.thought;
        console.log("Found pending conscious thought to send:", consciousThought);
        // Clear the pending thought after using it
        setPendingConsciousThought(null);
      }

      const newMessage: Message = {
        id: Date.now().toString(), // Temporary ID, useChat will assign a proper one
        role: "user" as const,
        content: input,
        createdAt: new Date(),
      };
      setInput("");
      const allMessages = [...messages, newMessage];

      // Fetch emotion based on messages *after* adding the new one
      let newEmotion = "Neutral";
      try {
        const emotionResponse = await fetch("/api/ai/emotion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: allMessages,
            emotionHistory,
          }), // Current messages
        });
        if (emotionResponse.ok) {
          const emotionData = await emotionResponse.json();
          newEmotion = emotionData.emotion || "Neutral";
          setEmotionHistory([...emotionHistory, newEmotion]);
        } else {
          console.error(
            "Failed to fetch emotion:",
            await emotionResponse.text()
          );
        }
      } catch (error) {
        console.error("Error fetching emotion:", error);
      }

      // Non-blocking call to conscious thought endpoint with the new message included

      (async () => {
        console.log("Fetching conscious thought with new message");
        try {
          const consciousThoughtResponse = await fetch("/api/ai/conscious", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: allMessages }),
          });
          if (consciousThoughtResponse.ok) {
            const consciousThoughtData = await consciousThoughtResponse.json();
            console.log("Conscious thought response:", consciousThoughtData);
            
            // Format and store the conscious thought
            const thoughts: string[] = [];
            if (consciousThoughtData.logicalThought) {
              thoughts.push(`Logical: ${consciousThoughtData.logicalThought.join(' → ')}`);
            }
            if (consciousThoughtData.creativeThought) {
              thoughts.push(`Creative: ${consciousThoughtData.creativeThought.join(' → ')}`);
            }
            
            if (thoughts.length > 0) {
              // Find the last assistant message ID
              const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
              if (lastAssistantMessage) {
                const thoughtContent = thoughts.join('\n');
                console.log("Setting pending conscious thought:", thoughtContent);
                setPendingConsciousThought({
                  thought: thoughtContent,
                  forMessageId: lastAssistantMessage.id
                });
              }
            }
          } else {
            console.error(
              "Failed to fetch conscious thought:",
              await consciousThoughtResponse.text()
            );
          }
        } catch (error) {
          console.error("Error fetching conscious thought:", error);
        }
      })();

      // Append the new message and trigger the main chat API call
      await append(newMessage, {
        body: {
          currentEmotion: newEmotion,
          interactionLessons,
          consciousThought,
        },
      });
    },
    [
      input,
      messages,
      interactionLessons,
      append,
      setInput,
      emotionHistory,
      setEmotionHistory,
      pendingConsciousThought,
    ]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50 container mx-auto">
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b p-4">
          <CardTitle>Memory Chat</CardTitle>
          <SaveConversationButton messages={messages} />
        </CardHeader>
        <CardContent className="flex-1 p-6 overflow-y-auto bg-gray-50">
          <ChatContainer
            messages={messages}
            isLoading={status !== "ready"}
            onEditMessage={handleEditMessage}
            currentEmotion={emotionHistory[emotionHistory.length - 1]}
          />
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
