import { Database, Json } from "@/utils/supabase/database.types";
import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

export type CustomTool = Database["public"]["Tables"]["custom_tools"]["Row"];
export type CustomToolInsert =
  Database["public"]["Tables"]["custom_tools"]["Insert"];
export type CustomToolUpdate =
  Database["public"]["Tables"]["custom_tools"]["Update"];

export type CustomToolImplementation =
  Database["public"]["Tables"]["custom_tool_implementations"]["Row"];
export type CustomToolImplementationInsert =
  Database["public"]["Tables"]["custom_tool_implementations"]["Insert"];
export type CustomToolImplementationUpdate =
  Database["public"]["Tables"]["custom_tool_implementations"]["Update"];

export type CustomToolExecution =
  Database["public"]["Tables"]["custom_tool_executions"]["Row"];
export type CustomToolExecutionInsert =
  Database["public"]["Tables"]["custom_tool_executions"]["Insert"];

export interface CustomToolWithImplementation {
  tool: CustomTool;
  implementation: CustomToolImplementation;
}

export interface CustomToolFormData {
  name: string;
  description: string;
  input_schema: Json;
  execute_code: string;
  sync_tool_code?: string | null;
  is_async?: boolean;
}

// Get all custom tools for the current user
export async function getCustomTools(supabaseClient: SupabaseClient) {
  const { data: tools, error } = await supabaseClient
    .from("custom_tools")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching custom tools:", error);
    throw new Error("Failed to fetch custom tools");
  }

  return tools;
}

// Get a single custom tool by ID
export async function getCustomToolById(
  id: string,
  supabaseClient: SupabaseClient
) {
  const { data: tool, error } = await supabaseClient
    .from("custom_tools")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching custom tool:", error);
    throw new Error("Failed to fetch custom tool");
  }

  return tool;
}

// Get a custom tool with its current implementation
export async function getCustomToolWithImplementation(
  id: string,
  supabaseClient: SupabaseClient
): Promise<CustomToolWithImplementation | null> {
  // Get the custom tool
  const { data: tool, error: toolError } = await supabaseClient
    .from("custom_tools")
    .select("*")
    .eq("id", id)
    .single();

  if (toolError) {
    console.error("Error fetching custom tool:", toolError);
    throw new Error("Failed to fetch custom tool");
  }

  // Get the current implementation
  const { data: implementation, error: implError } = await supabaseClient
    .from("custom_tool_implementations")
    .select("*")
    .eq("tool_id", id)
    .eq("is_current_version", true)
    .single();

  if (implError) {
    console.error("Error fetching implementation:", implError);
    throw new Error("Failed to fetch tool implementation");
  }

  return {
    tool,
    implementation,
  };
}

// Get all implementations for a custom tool
export async function getCustomToolImplementations(
  toolId: string,
  supabaseClient: SupabaseClient
) {
  const { data: implementations, error } = await supabaseClient
    .from("custom_tool_implementations")
    .select("*")
    .eq("tool_id", toolId)
    .order("version", { ascending: false });

  if (error) {
    console.error("Error fetching implementations:", error);
    throw new Error("Failed to fetch tool implementations");
  }

  return implementations;
}

// Get execution history for a custom tool
export async function getCustomToolExecutions(
  toolId: string,
  supabaseClient: SupabaseClient,
  limit = 10
) {
  const { data: executions, error } = await supabaseClient
    .from("custom_tool_executions")
    .select("*")
    .eq("tool_id", toolId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching tool executions:", error);
    throw new Error("Failed to fetch tool executions");
  }

  return executions;
}

// Create a new custom tool
export async function createCustomTool(
  formData: CustomToolFormData,
  supabaseClient: SupabaseClient
) {
  // Get current user
  const { data: userData } = await supabaseClient.auth.getUser();

  if (!userData.user) {
    throw new Error("User not found");
  }

  const toolId = uuidv4();

  // First create the tool
  const newTool: CustomToolInsert = {
    id: toolId,
    name: formData.name,
    description: formData.description,
    input_schema: formData.input_schema,
    is_async: formData.is_async || false,
    is_active: true,
    owner: userData.user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: tool, error: toolError } = await supabaseClient
    .from("custom_tools")
    .insert([newTool])
    .select()
    .single();

  if (toolError) {
    console.error("Error creating custom tool:", toolError);
    throw new Error("Failed to create custom tool");
  }

  // Then create the implementation
  const newImplementation: CustomToolImplementationInsert = {
    tool_id: toolId,
    execute_code: formData.execute_code,
    sync_tool_code: formData.sync_tool_code || null,
    is_current_version: true,
    version: 1, // Initial version
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: implError } = await supabaseClient
    .from("custom_tool_implementations")
    .insert([newImplementation]);

  if (implError) {
    console.error("Error creating implementation:", implError);
    // If implementation creation fails, delete the tool
    await supabaseClient.from("custom_tools").delete().eq("id", toolId);
    throw new Error("Failed to create tool implementation");
  }

  return tool;
}

// Update a custom tool
export async function updateCustomTool(
  id: string,
  formData: CustomToolFormData,
  supabaseClient: SupabaseClient
) {
  // First update the tool
  const { data: tool, error: toolError } = await supabaseClient
    .from("custom_tools")
    .update({
      name: formData.name,
      description: formData.description,
      input_schema: formData.input_schema,
      is_async: formData.is_async || false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (toolError) {
    console.error("Error updating custom tool:", toolError);
    throw new Error("Failed to update custom tool");
  }

  // Get the current version number
  const { data: currentImpl, error: fetchError } = await supabaseClient
    .from("custom_tool_implementations")
    .select("version")
    .eq("tool_id", id)
    .eq("is_current_version", true)
    .single();

  if (fetchError) {
    console.error("Error fetching current implementation:", fetchError);
    throw new Error("Failed to fetch current implementation");
  }

  const nextVersion = (currentImpl?.version || 0) + 1;

  // Mark all previous implementations as not current
  await supabaseClient
    .from("custom_tool_implementations")
    .update({ is_current_version: false })
    .eq("tool_id", id);

  // Create a new implementation version
  const { error: implError } = await supabaseClient
    .from("custom_tool_implementations")
    .insert({
      tool_id: id,
      execute_code: formData.execute_code,
      sync_tool_code: formData.sync_tool_code || null,
      is_current_version: true,
      version: nextVersion,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (implError) {
    console.error("Error creating implementation:", implError);
    throw new Error("Failed to create tool implementation");
  }

  return tool;
}

// Toggle the active status of a custom tool
export async function toggleCustomToolStatus(
  id: string,
  isActive: boolean,
  supabaseClient: SupabaseClient
) {
  const { data, error } = await supabaseClient
    .from("custom_tools")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating tool status:", error);
    throw new Error("Failed to update tool status");
  }

  return data;
}

// Delete a custom tool
export async function deleteCustomTool(
  id: string,
  supabaseClient: SupabaseClient
) {
  // Delete the tool (cascades to implementations and executions)
  const { error } = await supabaseClient
    .from("custom_tools")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting custom tool:", error);
    throw new Error("Failed to delete custom tool");
  }

  return true;
}

// Record a tool execution
export async function recordToolExecution(
  toolId: string,
  implementationId: string,
  agentId: string | null,
  inputArgs: Json,
  outputResult: Json | null,
  success: boolean,
  errorMessage: string | null,
  executionTimeMs: number,
  supabaseClient: SupabaseClient
) {
  const execution: CustomToolExecutionInsert = {
    tool_id: toolId,
    implementation_id: implementationId,
    agent_id: agentId,
    input_args: inputArgs,
    output_result: outputResult,
    success,
    error_message: errorMessage,
    execution_time_ms: executionTimeMs,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabaseClient
    .from("custom_tool_executions")
    .insert([execution]);

  if (error) {
    console.error("Error recording tool execution:", error);
    throw new Error("Failed to record tool execution");
  }

  return true;
}
