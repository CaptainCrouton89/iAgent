import React from "react";
import { useAgentMessages } from "../hooks/useAgentMessages";

type MessageRole = "user" | "assistant" | "system";

interface AgentMessageHistoryProps {
  agentId: string;
  onSendMessage?: (content: string) => void;
}

export function AgentMessageHistory({
  agentId,
  onSendMessage,
}: AgentMessageHistoryProps) {
  const { messages, loading, error, addMessage, clearHistory } =
    useAgentMessages(agentId);
  const [newMessage, setNewMessage] = React.useState("");

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    // Add user message to history
    await addMessage("user", newMessage);

    // Call the optional callback if provided
    if (onSendMessage) {
      onSendMessage(newMessage);
    }

    // Clear input
    setNewMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Function to format message timestamp
  const formatTime = (timestamp: string) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Helper function to determine message style based on role
  const getMessageStyle = (role: MessageRole) => {
    const baseClasses = "p-3 rounded-lg mb-2 max-w-[80%]";

    switch (role) {
      case "user":
        return `${baseClasses} bg-blue-500 text-white self-end`;
      case "assistant":
        return `${baseClasses} bg-gray-200 text-gray-800 self-start`;
      case "system":
        return `${baseClasses} bg-yellow-100 text-gray-800 self-center italic`;
      default:
        return baseClasses;
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading messages...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500 text-center">{error}</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold">Message History</h2>
        <button
          onClick={() => clearHistory()}
          className="text-sm text-red-500 hover:text-red-700"
        >
          Clear History
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 my-auto">
            No messages yet.
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`${getMessageStyle(
                msg.role as MessageRole
              )} flex flex-col`}
            >
              <div>{msg.content}</div>
              <div className="text-xs opacity-70 mt-1">
                {formatTime(msg.created_at || "")}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t p-4">
        <div className="flex">
          <textarea
            className="flex-1 border rounded-l-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            className="bg-blue-500 text-white rounded-r-lg px-4 hover:bg-blue-600"
            onClick={handleSendMessage}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
