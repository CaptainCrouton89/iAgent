import { useCallback, useEffect, useRef, useState } from "react";
import { Json } from "../../supabase/database.types";
import {
  AgentMessageService,
  Message,
  MessageRole,
} from "../deprecated/agentMessageService";

export function useAgentMessages(agentId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const messageServiceRef = useRef(new AgentMessageService());

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);
      try {
        const messageHistory =
          await messageServiceRef.current.getMessageHistory(agentId);
        setMessages(messageHistory);
        setError(null);
      } catch (err) {
        console.error("Error loading agent messages:", err);
        setError("Failed to load message history");
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [agentId]);

  // Add a new message
  const addMessage = useCallback(
    async (role: MessageRole, content: string, metadata?: Json) => {
      try {
        const newMessage = await messageServiceRef.current.addMessage({
          agent_id: agentId,
          role,
          content,
          metadata,
        });

        if (newMessage) {
          setMessages((prev) => [...prev, newMessage]);
          return newMessage;
        }
        return null;
      } catch (err) {
        console.error("Error adding message:", err);
        setError("Failed to add message");
        return null;
      }
    },
    [agentId]
  );

  // Clear message history
  const clearHistory = useCallback(async () => {
    try {
      const success = await messageServiceRef.current.clearAgentHistory(
        agentId
      );
      if (success) {
        setMessages([]);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error clearing message history:", err);
      setError("Failed to clear message history");
      return false;
    }
  }, [agentId]);

  // Delete a specific message
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      const success = await messageServiceRef.current.deleteMessage(messageId);
      if (success) {
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error deleting message:", err);
      setError("Failed to delete message");
      return false;
    }
  }, []);

  return {
    messages,
    loading,
    error,
    addMessage,
    clearHistory,
    deleteMessage,
  };
}
