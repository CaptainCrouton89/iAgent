import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { Database } from "@/utils/supabase/database.types";

export type Agent = Database["public"]["Tables"]["agents"]["Row"];
export type AgentInsert = Database["public"]["Tables"]["agents"]["Insert"];
export type AgentUpdate = Database["public"]["Tables"]["agents"]["Update"];

// Get all agents for the current user
export async function getAgents(supabaseClient: SupabaseClient) {
  const { data: agents, error } = await supabaseClient
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching agents:", error);
    throw new Error("Failed to fetch agents");
  }

  return agents;
}

// Get a single agent by ID
export async function getAgentById(id: string, supabaseClient: SupabaseClient) {
  const { data: agent, error } = await supabaseClient
    .from("agents")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching agent:", error);
    throw new Error("Failed to fetch agent");
  }

  return agent;
}

// Get agent with its associated tasks
export async function getAgentWithTasks(
  id: string,
  supabaseClient: SupabaseClient
) {
  // Get the agent
  const { data: agent, error: agentError } = await supabaseClient
    .from("agents")
    .select("*")
    .eq("id", id)
    .single();

  if (agentError) {
    console.error("Error fetching agent:", agentError);
    throw new Error("Failed to fetch agent");
  }

  // Get tasks associated with this agent
  const { data: tasks, error: tasksError } = await supabaseClient
    .from("tasks")
    .select("*")
    .eq("owner_id", id)
    .order("created_at", { ascending: false });

  if (tasksError) {
    console.error("Error fetching tasks for agent:", tasksError);
    throw new Error("Failed to fetch tasks for agent");
  }

  return {
    ...agent,
    tasks,
  };
}

// Create a new agent
export async function createAgent(
  agent: Omit<AgentInsert, "id" | "created_at" | "updated_at" | "owner">,
  supabaseClient: SupabaseClient
) {
  // Get current user
  const { data: userData } = await supabaseClient.auth.getUser();

  if (!userData.user) {
    throw new Error("User not found");
  }

  const newAgent: AgentInsert = {
    ...agent,
    id: uuidv4(),
    owner: userData.user.id,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient
    .from("agents")
    .insert([newAgent])
    .select()
    .single();

  if (error) {
    console.error("Error creating agent:", error);
    throw new Error("Failed to create agent");
  }

  return data;
}

// Update an agent
export async function updateAgent(
  id: string,
  updates: Partial<AgentUpdate>,
  supabaseClient: SupabaseClient
) {
  const { data, error } = await supabaseClient
    .from("agents")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating agent:", error);
    throw new Error("Failed to update agent");
  }

  return data;
}

// Delete an agent
export async function deleteAgent(id: string, supabaseClient: SupabaseClient) {
  // First delete all associated tasks
  const { error: tasksError } = await supabaseClient
    .from("tasks")
    .delete()
    .eq("owner_id", id);

  if (tasksError) {
    console.error("Error deleting agent tasks:", tasksError);
    throw new Error("Failed to delete agent tasks");
  }

  // Finally delete the agent
  const { error } = await supabaseClient.from("agents").delete().eq("id", id);

  if (error) {
    console.error("Error deleting agent:", error);
    throw new Error("Failed to delete agent");
  }

  return true;
}
