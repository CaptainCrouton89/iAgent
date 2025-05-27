import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Json } from "@/utils/supabase/database.types";

type MessageRole = "user" | "assistant" | "system";

interface Message {
  id: string;
  agent_id: string;
  role: MessageRole;
  content: string;
  metadata?: Json;
  created_at: string;
  updated_at: string;
}

export function useAgentMessages(agentId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("agent_message_history")
          .select("*")
          .eq("agent_id", agentId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        
        setMessages(data || []);
        setError(null);
      } catch (err) {
        console.error("Error loading agent messages:", err);
        setError("Failed to load message history");
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [agentId, supabase]);

  // Add a new message
  const addMessage = useCallback(
    async (role: MessageRole, content: string, metadata?: Json) => {
      try {
        const { data, error } = await supabase
          .from("agent_message_history")
          .insert({
            agent_id: agentId,
            role,
            content,
            metadata,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setMessages((prev) => [...prev, data]);
          return data;
        }
        return null;
      } catch (err) {
        console.error("Error adding message:", err);
        setError("Failed to add message");
        return null;
      }
    },
    [agentId, supabase]
  );

  // Clear message history
  const clearHistory = useCallback(async () => {
    try {
      const { error } = await supabase
        .from("agent_message_history")
        .delete()
        .eq("agent_id", agentId);

      if (error) throw error;

      setMessages([]);
      return true;
    } catch (err) {
      console.error("Error clearing message history:", err);
      setError("Failed to clear message history");
      return false;
    }
  }, [agentId, supabase]);

  // Delete a specific message
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("agent_message_history")
        .delete()
        .eq("id", messageId);

      if (error) throw error;

      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      return true;
    } catch (err) {
      console.error("Error deleting message:", err);
      setError("Failed to delete message");
      return false;
    }
  }, [supabase]);

  return {
    messages,
    loading,
    error,
    addMessage,
    clearHistory,
    deleteMessage,
  };
}