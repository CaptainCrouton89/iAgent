"use client";

import { useControlledCompletion } from "@/lib/chat/useControlledCompletion";
import { useState } from "react";

export default function StreamChat() {
  const [input, setInput] = useState("");
  const { generate, completion, isLoading } = useControlledCompletion();

  return (
    <div className="p-4 max-w-xl mx-auto">
      <textarea
        className="w-full p-2 border rounded mb-2"
        rows={3}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type a prompt..."
      />
      <button
        onClick={() => generate(input)}
        disabled={isLoading}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {isLoading ? "Streaming..." : "Submit"}
      </button>

      <div className="mt-4 whitespace-pre-wrap text-sm bg-gray-100 p-2 rounded">
        {completion || (isLoading && "Waiting for response...")}
      </div>
    </div>
  );
}
