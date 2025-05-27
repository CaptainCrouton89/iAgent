import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { Database } from "@/utils/supabase/database.types";

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

// Get all tasks for the current user
export async function getTasks(supabaseClient: SupabaseClient) {
  const { data: tasks, error } = await supabaseClient
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tasks:", error);
    throw new Error("Failed to fetch tasks");
  }

  return tasks;
}

// Get tasks by agent ID
export async function getTasksByAgentId(
  agentId: string,
  supabaseClient: SupabaseClient
) {
  const { data: tasks, error } = await supabaseClient
    .from("tasks")
    .select("*")
    .eq("owner_id", agentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tasks for agent:", error);
    throw new Error("Failed to fetch tasks for agent");
  }

  return tasks;
}

// Get tasks by parent ID (subtasks)
export async function getSubtasks(
  parentId: string,
  supabaseClient: SupabaseClient
) {
  const { data: tasks, error } = await supabaseClient
    .from("tasks")
    .select("*")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching subtasks:", error);
    throw new Error("Failed to fetch subtasks");
  }

  return tasks;
}

// Get a single task by ID
export async function getTaskById(id: string, supabaseClient: SupabaseClient) {
  const { data: task, error } = await supabaseClient
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching task:", error);
    throw new Error("Failed to fetch task");
  }

  return task;
}

// Get a task with its subtasks
export async function getTaskWithSubtasks(
  id: string,
  supabaseClient: SupabaseClient
) {
  // Get the task
  const { data: task, error: taskError } = await supabaseClient
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (taskError) {
    console.error("Error fetching task:", taskError);
    throw new Error("Failed to fetch task");
  }

  // Get subtasks
  const { data: subtasks, error: subtasksError } = await supabaseClient
    .from("tasks")
    .select("*")
    .eq("parent_id", id)
    .order("created_at", { ascending: false });

  if (subtasksError) {
    console.error("Error fetching subtasks:", subtasksError);
    throw new Error("Failed to fetch subtasks");
  }

  return {
    ...task,
    subtasks,
  };
}

// Create a new task
export async function createTask(
  task: Omit<TaskInsert, "id" | "created_at" | "updated_at" | "owner">,
  supabaseClient: SupabaseClient
) {
  // Get current user
  const { data: userData } = await supabaseClient.auth.getUser();

  const newTask: TaskInsert = {
    ...task,
    id: uuidv4(),
    owner: userData.user?.id || null,
    status: task.status || "todo",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient
    .from("tasks")
    .insert([newTask])
    .select()
    .single();

  if (error) {
    console.error("Error creating task:", error);
    throw new Error("Failed to create task");
  }

  return data;
}

// Update a task
export async function updateTask(
  id: string,
  updates: Partial<TaskUpdate>,
  supabaseClient: SupabaseClient
) {
  const { data, error } = await supabaseClient
    .from("tasks")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating task:", error);
    throw new Error("Failed to update task");
  }

  return data;
}

// Delete a task
export async function deleteTask(id: string, supabaseClient: SupabaseClient) {
  // First delete all subtasks
  const { error: subtasksError } = await supabaseClient
    .from("tasks")
    .delete()
    .eq("parent_id", id);

  if (subtasksError) {
    console.error("Error deleting subtasks:", subtasksError);
    throw new Error("Failed to delete subtasks");
  }

  // Then delete the task
  const { error } = await supabaseClient.from("tasks").delete().eq("id", id);

  if (error) {
    console.error("Error deleting task:", error);
    throw new Error("Failed to delete task");
  }

  return true;
}

// Update task status
export async function updateTaskStatus(
  id: string,
  status: string,
  supabaseClient: SupabaseClient
) {
  return updateTask(id, { status }, supabaseClient);
}
