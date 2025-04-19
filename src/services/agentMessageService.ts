import { Json } from "../../supabase/database.types";
import { SupabaseService } from "./supabaseService";

// Define types for the message history
export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id?: string;
  agent_id: string;
  role: MessageRole;
  content: string;
  metadata?: Json;
  created_at?: string;
}

export class AgentMessageService {
  private supabaseService: SupabaseService;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  /**
   * Add a new message to an agent's history
   */
  async addMessage(message: Message): Promise<Message | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("agent_message_history")
      .insert(message)
      .select()
      .single();

    if (error) {
      console.error("Error adding message:", error);
      return null;
    }

    return data as Message;
  }

  /**
   * Get message history for a specific agent
   */
  async getMessageHistory(
    agentId: string,
    limit: number = 50,
    orderByRecent: boolean = true
  ): Promise<Message[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("agent_message_history")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: !orderByRecent })
      .limit(limit);

    if (error) {
      console.error("Error getting message history:", error);
      return [];
    }

    return data as Message[];
  }

  /**
   * Delete a specific message
   */
  async deleteMessage(messageId: string): Promise<boolean> {
    const { error } = await this.supabaseService
      .getClient()
      .from("agent_message_history")
      .delete()
      .eq("id", messageId);

    if (error) {
      console.error("Error deleting message:", error);
      return false;
    }

    return true;
  }

  /**
   * Clear all messages for an agent
   */
  async clearAgentHistory(agentId: string): Promise<boolean> {
    const { error } = await this.supabaseService
      .getClient()
      .from("agent_message_history")
      .delete()
      .eq("agent_id", agentId);

    if (error) {
      console.error("Error clearing agent history:", error);
      return false;
    }

    return true;
  }
}
