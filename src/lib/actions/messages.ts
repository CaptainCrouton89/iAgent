import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { Database } from "../../../supabase/database.types";

export type Message =
  Database["public"]["Tables"]["agent_message_history"]["Row"];
export type MessageInsert =
  Database["public"]["Tables"]["agent_message_history"]["Insert"];
export type MessageUpdate =
  Database["public"]["Tables"]["agent_message_history"]["Update"];

// Get all messages for a specific agent
export async function getMessagesByAgentId(
  agentId: string,
  supabaseClient: SupabaseClient
) {
  const { data: messages, error } = await supabaseClient
    .from("agent_message_history")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching messages:", error);
    throw new Error("Failed to fetch messages");
  }

  return messages;
}

// Get a single message by ID
export async function getMessageById(
  id: string,
  supabaseClient: SupabaseClient
) {
  const { data: message, error } = await supabaseClient
    .from("agent_message_history")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching message:", error);
    throw new Error("Failed to fetch message");
  }

  return message;
}

// Create a new message
export async function createMessage(
  message: Omit<MessageInsert, "id" | "created_at" | "updated_at" | "owner">,
  supabaseClient: SupabaseClient
) {
  // Get current user
  const { data: userData } = await supabaseClient.auth.getUser();

  const newMessage: MessageInsert = {
    ...message,
    id: uuidv4(),
    owner: userData.user?.id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient
    .from("agent_message_history")
    .insert([newMessage])
    .select()
    .single();

  if (error) {
    console.error("Error creating message:", error);
    throw new Error("Failed to create message");
  }

  return data;
}

// Update a message
export async function updateMessage(
  id: string,
  updates: Partial<MessageUpdate>,
  supabaseClient: SupabaseClient
) {
  const { data, error } = await supabaseClient
    .from("agent_message_history")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating message:", error);
    throw new Error("Failed to update message");
  }

  return data;
}

// Delete a message
export async function deleteMessage(
  id: string,
  supabaseClient: SupabaseClient
) {
  const { error } = await supabaseClient
    .from("agent_message_history")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting message:", error);
    throw new Error("Failed to delete message");
  }

  return true;
}

// Delete all messages for an agent
export async function deleteMessagesByAgentId(
  agentId: string,
  supabaseClient: SupabaseClient
) {
  const { error } = await supabaseClient
    .from("agent_message_history")
    .delete()
    .eq("agent_id", agentId);

  if (error) {
    console.error("Error deleting agent messages:", error);
    throw new Error("Failed to delete agent messages");
  }

  return true;
}
