import { Json } from "@/utils/supabase/database.types";
import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

// Temporary type definitions until database types are updated
export interface CustomTool {
  id: string;
  owner: string;
  name: string;
  description: string;
  input_schema: Json;
  metadata: Json | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomToolInsert {
  id?: string;
  owner: string;
  name: string;
  description: string;
  input_schema: Json;
  metadata?: Json | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CustomToolUpdate {
  name?: string;
  description?: string;
  input_schema?: Json;
  metadata?: Json | null;
  is_active?: boolean;
  updated_at?: string;
}

export interface CustomToolImplementation {
  id: string;
  tool_id: string;
  version: number;
  input_schema: Json;
  execute_code: string;
  output_schema: Json | null;
  requires_api_keys: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomToolImplementationInsert {
  id?: string;
  tool_id: string;
  version?: number;
  input_schema: Json;
  execute_code: string;
  output_schema?: Json | null;
  requires_api_keys?: string[] | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CustomToolImplementationUpdate {
  input_schema?: Json;
  execute_code?: string;
  output_schema?: Json | null;
  requires_api_keys?: string[] | null;
  is_active?: boolean;
  updated_at?: string;
}

export interface CustomToolExecution {
  id: string;
  implementation_id: string;
  executed_by: string;
  agent_id: string | null;
  input: Json;
  output: Json | null;
  success: boolean;
  error_message: string | null;
  execution_time_ms: number | null;
  created_at: string;
}

export interface CustomToolExecutionInsert {
  id?: string;
  implementation_id: string;
  executed_by: string;
  agent_id?: string | null;
  input: Json;
  output?: Json | null;
  success: boolean;
  error_message?: string | null;
  execution_time_ms?: number | null;
  created_at?: string;
}

export interface CustomToolWithImplementation {
  tool: CustomTool;
  implementation: CustomToolImplementation;
}

export interface CustomToolFormData {
  name: string;
  description: string;
  input_schema: Json;
  execute_code: string;
  output_schema?: Json;
  requires_api_keys?: string[];
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

// Get a custom tool with its current implementation
export async function getCustomToolWithImplementation(
  toolId: string,
  supabaseClient: SupabaseClient
): Promise<CustomToolWithImplementation | null> {
  // First get the tool
  const { data: tool, error: toolError } = await supabaseClient
    .from("custom_tools")
    .select("*")
    .eq("id", toolId)
    .single();

  if (toolError || !tool) {
    console.error("Error fetching tool:", toolError);
    return null;
  }

  // Then get the active implementation
  const { data: implementation, error: implError } = await supabaseClient
    .from("custom_tool_implementations")
    .select("*")
    .eq("tool_id", toolId)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (implError || !implementation) {
    console.error("Error fetching implementation:", implError);
    return null;
  }

  return {
    tool,
    implementation,
  };
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
  const now = new Date().toISOString();

  // Create the tool
  const newTool: CustomToolInsert = {
    id: toolId,
    owner: userData.user.id,
    name: formData.name,
    description: formData.description,
    input_schema: formData.input_schema,
    metadata: null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  const { data: tool, error: toolError } = await supabaseClient
    .from("custom_tools")
    .insert([newTool])
    .select()
    .single();

  if (toolError || !tool) {
    console.error("Error creating tool:", toolError);
    throw new Error("Failed to create tool");
  }

  // Create the initial implementation
  const newImplementation: CustomToolImplementationInsert = {
    id: uuidv4(),
    tool_id: toolId,
    version: 1,
    input_schema: formData.input_schema,
    execute_code: formData.execute_code,
    output_schema: formData.output_schema || null,
    requires_api_keys: formData.requires_api_keys || null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  const { data: implementation, error: implError } = await supabaseClient
    .from("custom_tool_implementations")
    .insert([newImplementation])
    .select()
    .single();

  if (implError || !implementation) {
    // Rollback: delete the tool if implementation creation fails
    await supabaseClient.from("custom_tools").delete().eq("id", toolId);
    console.error("Error creating implementation:", implError);
    throw new Error("Failed to create tool implementation");
  }

  return {
    tool,
    implementation,
  };
}

// Update a custom tool (creates a new implementation version)
export async function updateCustomTool(
  toolId: string,
  formData: Partial<CustomToolFormData>,
  supabaseClient: SupabaseClient
) {
  // Get the current implementation to determine the next version
  const { data: currentImpl, error: currentError } = await supabaseClient
    .from("custom_tool_implementations")
    .select("version")
    .eq("tool_id", toolId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (currentError) {
    console.error("Error fetching current implementation:", currentError);
    throw new Error("Failed to fetch current implementation");
  }

  const nextVersion = currentImpl ? currentImpl.version + 1 : 1;
  const now = new Date().toISOString();

  // Update the tool metadata if name or description changed
  if (formData.name || formData.description) {
    const toolUpdate: CustomToolUpdate = {
      ...(formData.name && { name: formData.name }),
      ...(formData.description && { description: formData.description }),
      updated_at: now,
    };

    const { error: toolError } = await supabaseClient
      .from("custom_tools")
      .update(toolUpdate)
      .eq("id", toolId);

    if (toolError) {
      console.error("Error updating tool:", toolError);
      throw new Error("Failed to update tool");
    }
  }

  // Deactivate previous implementations
  const { error: deactivateError } = await supabaseClient
    .from("custom_tool_implementations")
    .update({ is_active: false })
    .eq("tool_id", toolId);

  if (deactivateError) {
    console.error("Error deactivating previous implementations:", deactivateError);
    throw new Error("Failed to deactivate previous implementations");
  }

  // Create new implementation version
  if (
    formData.input_schema ||
    formData.execute_code ||
    formData.output_schema ||
    formData.requires_api_keys
  ) {
    const newImplementation: CustomToolImplementationInsert = {
      id: uuidv4(),
      tool_id: toolId,
      version: nextVersion,
      input_schema: formData.input_schema!,
      execute_code: formData.execute_code!,
      output_schema: formData.output_schema || null,
      requires_api_keys: formData.requires_api_keys || null,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    const { data: implementation, error: implError } = await supabaseClient
      .from("custom_tool_implementations")
      .insert([newImplementation])
      .select()
      .single();

    if (implError || !implementation) {
      console.error("Error creating new implementation:", implError);
      throw new Error("Failed to create new implementation");
    }
  }

  // Return the updated tool with its new implementation
  return getCustomToolWithImplementation(toolId, supabaseClient);
}

// Delete a custom tool
export async function deleteCustomTool(
  toolId: string,
  supabaseClient: SupabaseClient
) {
  const { error } = await supabaseClient
    .from("custom_tools")
    .delete()
    .eq("id", toolId);

  if (error) {
    console.error("Error deleting tool:", error);
    throw new Error("Failed to delete tool");
  }

  return true;
}

// Toggle tool active status
export async function toggleCustomToolStatus(
  toolId: string,
  isActive: boolean,
  supabaseClient: SupabaseClient
) {
  const { data, error } = await supabaseClient
    .from("custom_tools")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", toolId)
    .select()
    .single();

  if (error) {
    console.error("Error updating tool status:", error);
    throw new Error("Failed to update tool status");
  }

  return data;
}

// Record a tool execution
export async function recordToolExecution(
  _toolId: string,
  implementationId: string,
  agentId: string | null,
  input: Json,
  output: Json | null,
  success: boolean,
  errorMessage: string | null,
  executionTimeMs: number | null,
  supabaseClient: SupabaseClient
) {
  // Get current user
  const { data: userData } = await supabaseClient.auth.getUser();

  if (!userData.user) {
    throw new Error("User not found");
  }

  const execution: CustomToolExecutionInsert = {
    id: uuidv4(),
    implementation_id: implementationId,
    executed_by: userData.user.id,
    agent_id: agentId,
    input,
    output,
    success,
    error_message: errorMessage,
    execution_time_ms: executionTimeMs,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient
    .from("custom_tool_executions")
    .insert([execution])
    .select()
    .single();

  if (error) {
    console.error("Error recording execution:", error);
    throw new Error("Failed to record execution");
  }

  return data;
}

// Get execution history for a tool
export async function getToolExecutions(
  toolId: string,
  limit: number = 50,
  supabaseClient: SupabaseClient
) {
  const { data: executions, error } = await supabaseClient
    .from("custom_tool_executions")
    .select(
      `
      *,
      implementation:custom_tool_implementations(
        version,
        tool_id
      )
    `
    )
    .eq("implementation.tool_id", toolId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching executions:", error);
    throw new Error("Failed to fetch executions");
  }

  return executions;
}