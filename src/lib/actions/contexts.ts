import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { Database } from "../../../supabase/database.types";

export type Context = Database["public"]["Tables"]["contexts"]["Row"];
export type ContextInsert = Database["public"]["Tables"]["contexts"]["Insert"];
export type ContextUpdate = Database["public"]["Tables"]["contexts"]["Update"];

// Get all contexts for the current user
export async function getContexts(supabaseClient: SupabaseClient) {
  const { data: contexts, error } = await supabaseClient
    .from("contexts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching contexts:", error);
    throw new Error("Failed to fetch contexts");
  }

  return contexts;
}

// Get a single context by ID
export async function getContextById(
  id: string,
  supabaseClient: SupabaseClient
) {
  const { data: context, error } = await supabaseClient
    .from("contexts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching context:", error);
    throw new Error("Failed to fetch context");
  }

  return context;
}

// Create a new context
export async function createContext(
  textData: string,
  supabaseClient: SupabaseClient
) {
  // Get current user
  const { data: userData } = await supabaseClient.auth.getUser();

  const newContext: ContextInsert = {
    id: uuidv4(),
    owner: userData.user?.id || null,
    text_data: textData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient
    .from("contexts")
    .insert([newContext])
    .select()
    .single();

  if (error) {
    console.error("Error creating context:", error);
    throw new Error("Failed to create context");
  }

  return data;
}

// Update a context
export async function updateContext(
  id: string,
  textData: string,
  supabaseClient: SupabaseClient
) {
  const { data, error } = await supabaseClient
    .from("contexts")
    .update({
      text_data: textData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating context:", error);
    throw new Error("Failed to update context");
  }

  return data;
}

// Delete a context
export async function deleteContext(
  id: string,
  supabaseClient: SupabaseClient
) {
  // First check if this context is referenced by any agents
  const { data: agents } = await supabaseClient
    .from("agents")
    .select("id")
    .eq("context_id", id);

  if (agents && agents.length > 0) {
    throw new Error("Cannot delete context that is being used by agents");
  }

  // Check if context is referenced by any tasks
  const { data: tasks } = await supabaseClient
    .from("tasks")
    .select("id")
    .eq("context_id", id);

  if (tasks && tasks.length > 0) {
    throw new Error("Cannot delete context that is being used by tasks");
  }

  // If no references, delete the context
  const { error } = await supabaseClient.from("contexts").delete().eq("id", id);

  if (error) {
    console.error("Error deleting context:", error);
    throw new Error("Failed to delete context");
  }

  return true;
}
