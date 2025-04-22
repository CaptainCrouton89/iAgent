import { createClient } from "@/utils/supabase/client";
import { Json } from "../../supabase/database.types";

export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  agent_id: string;
  role: MessageRole;
  content: string;
  metadata?: Json;
  created_at?: string;
  updated_at?: string;
}

export interface MessageInput {
  agent_id: string;
  role: MessageRole;
  content: string;
  metadata?: Json;
}

export class AgentMessageService {
  // Get message history for a specific agent
  async getMessageHistory(agentId: string): Promise<Message[]> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("agent_message_history")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data as Message[];
    } catch (error) {
      console.error("Error getting message history:", error);
      throw error;
    }
  }

  // Add a new message
  async addMessage(messageInput: MessageInput): Promise<Message | null> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("agent_message_history")
        .insert([messageInput])
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as Message;
    } catch (error) {
      console.error("Error adding message:", error);
      throw error;
    }
  }

  // Clear message history for a specific agent
  async clearAgentHistory(agentId: string): Promise<boolean> {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("agent_message_history")
        .delete()
        .eq("agent_id", agentId);

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      console.error("Error clearing agent history:", error);
      throw error;
    }
  }

  // Delete a specific message
  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("agent_message_history")
        .delete()
        .eq("id", messageId);

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  }
}
