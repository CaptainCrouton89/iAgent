"use client";

import { useEffect, useState } from "react";
import { MessageBubble } from "../components/MessageBubble";
import "../markdown.css";
import testMessages from "../test.json";
import { Message } from "../types";

export default function TestPage() {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    // Load the test messages
    setMessages(testMessages as Message[]);
  }, []);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Message Format Test</h1>

      <div className="space-y-6">
        {messages.map((message, index) => (
          <MessageBubble
            key={index}
            message={message}
            isAssistant={
              message.role === "assistant" || message.role === "tool"
            }
          />
        ))}
      </div>
    </div>
  );
}
