"use client";

import { useControlledCompletion } from "@/lib/chat/useControlledCompletion";
import OpenAI from "openai";
import { useEffect, useRef, useState } from "react";

export default function StreamChat() {
  const [input, setInput] = useState("");
  const {
    generate,
    completion,
    isLoading,
    messageHistory,
    addUserMessage,
    clearHistory,
  } = useControlledCompletion();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    if (input.trim()) {
      const newUserMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam =
        { role: "user", content: input };
      // Add user message to local history immediately for better UX
      addUserMessage(input);
      // Send the new user message to the backend to get a response
      generate([newUserMessage]);
      setInput("");
    }
  };

  // Scroll to bottom when new messages are added or completion updates
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messageHistory, completion]);

  return (
    <div className="flex flex-col h-screen p-4 max-w-2xl mx-auto bg-slate-900 text-slate-50">
      <h1 className="text-2xl font-bold mb-4 text-center">Conscious Stream</h1>
      <div
        ref={chatContainerRef}
        className="flex-grow mb-4 p-4 border border-slate-700 rounded-lg overflow-y-auto bg-slate-800 space-y-4"
      >
        {messageHistory.map((msg, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg max-w-[85%] ${
              msg.role === "user"
                ? "bg-sky-600 text-white self-end ml-auto"
                : "bg-slate-700 text-slate-200 self-start mr-auto"
            }`}
          >
            <p className="font-semibold capitalize">
              {msg.role === "developer" ? "Internal Thought" : msg.role}
            </p>
            <p className="whitespace-pre-wrap">{msg.content as string}</p>
          </div>
        ))}
        {isLoading && completion && (
          <div className="p-3 rounded-lg max-w-[85%] bg-slate-700 text-slate-200 self-start mr-auto">
            <p className="font-semibold capitalize">assistant</p>
            <p className="whitespace-pre-wrap">{completion}</p>
          </div>
        )}
        {isLoading && !completion && (
          <div className="p-3 rounded-lg max-w-[85%] bg-slate-700 text-slate-200 self-start mr-auto animate-pulse">
            <p className="font-semibold capitalize">assistant</p>
            <p className="whitespace-pre-wrap">Thinking...</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <textarea
          className="flex-grow p-3 border border-slate-700 rounded-lg bg-slate-800 text-slate-50 focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message..."
        />
        <button
          onClick={handleSend}
          disabled={isLoading}
          className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {isLoading ? "Sending..." : "Send"}
        </button>
        <button
          onClick={() => clearHistory()}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
