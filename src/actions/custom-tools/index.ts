"use server";

import { ToolResult } from "@/app/(protected)/private/chat/types";
import { CustomToolFormData } from "@/lib/actions/customTools";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Interface for a field in the tool input schema
 */
export interface ToolInputField {
  type: string;
  description: string;
  required: boolean;
  minimum?: number;
  maximum?: number;
  enum?: string[];
  default?: unknown;
}

/**
 * Interface for the tool input schema
 */
export interface ToolInputSchema {
  properties: Record<string, ToolInputField>;
  required: string[];
  additionalProperties: boolean;
}

/**
 * Interface for the result of a tool execution
 */
export interface ToolExecutionResult {
  success: boolean;
  result?: ToolResult;
  error?: string;
  executionTime?: number;
}

/**
 * Create a new custom tool
 */
export async function createCustomTool(
  formData: CustomToolFormData
): Promise<{ id: string } | null> {
  try {
    const supabase = await createClient();

    // First create the tool
    const { data: toolData, error: toolError } = await supabase
      .from("custom_tools")
      .insert({
        name: formData.name,
        description: formData.description,
        input_schema: formData.input_schema,
        is_async: formData.is_async || false,
        is_active: true,
      })
      .select()
      .single();

    if (toolError) {
      console.error("Error creating custom tool:", toolError);
      return null;
    }

    // Then create the implementation
    const { error: implError } = await supabase
      .from("custom_tool_implementations")
      .insert({
        tool_id: toolData.id,
        execute_code: formData.execute_code,
        sync_tool_code: formData.sync_tool_code || null,
        is_current_version: true,
        version: 1,
      });

    if (implError) {
      console.error("Error creating custom tool implementation:", implError);
      // If implementation creation fails, delete the tool
      await supabase.from("custom_tools").delete().eq("id", toolData.id);
      return null;
    }

    revalidatePath("/tools");
    return { id: toolData.id };
  } catch (error) {
    console.error("Unexpected error creating custom tool:", error);
    return null;
  }
}

/**
 * Get all custom tools for the current user
 */
export async function getUserTools(): Promise<
  Array<{
    id: string;
    owner: string;
    name: string;
    description: string;
    is_async: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    input_schema: Record<string, unknown>;
  }>
> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("custom_tools")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching custom tools:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Unexpected error fetching custom tools:", error);
    return [];
  }
}

/**
 * Get a tool with its current implementation
 */
export async function getToolWithImplementation(toolId: string): Promise<{
  tool_id: string;
  tool_name: string;
  owner: string;
  description: string;
  input_schema: Record<string, unknown>;
  is_async: boolean;
  is_active: boolean;
  implementation_id: string;
  execute_code: string;
  sync_tool_code: string | null;
  version: number;
} | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("current_tool_implementations")
      .select("*")
      .eq("tool_id", toolId)
      .single();

    if (error) {
      console.error("Error fetching tool implementation:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Unexpected error fetching tool implementation:", error);
    return null;
  }
}

/**
 * Update an existing tool and its implementation
 */
export async function updateTool(
  toolId: string,
  formData: CustomToolFormData
): Promise<boolean> {
  try {
    const supabase = await createClient();

    // First update the tool
    const { error: toolError } = await supabase
      .from("custom_tools")
      .update({
        name: formData.name,
        description: formData.description,
        input_schema: formData.input_schema,
        is_async: formData.is_async || false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", toolId);

    if (toolError) {
      console.error("Error updating custom tool:", toolError);
      return false;
    }

    // Then create a new implementation version
    const { error: implError } = await supabase
      .from("custom_tool_implementations")
      .insert({
        tool_id: toolId,
        execute_code: formData.execute_code,
        sync_tool_code: formData.sync_tool_code || null,
        is_current_version: true,
        // version will be set by the trigger
      });

    if (implError) {
      console.error("Error creating updated implementation:", implError);
      return false;
    }

    revalidatePath("/tools");
    revalidatePath(`/tools/${toolId}`);
    return true;
  } catch (error) {
    console.error("Unexpected error updating custom tool:", error);
    return false;
  }
}

/**
 * Delete a custom tool
 */
export async function deleteTool(toolId: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    // The implementation will be deleted by the cascade
    const { error } = await supabase
      .from("custom_tools")
      .delete()
      .eq("id", toolId);

    if (error) {
      console.error("Error deleting custom tool:", error);
      return false;
    }

    revalidatePath("/tools");
    return true;
  } catch (error) {
    console.error("Unexpected error deleting custom tool:", error);
    return false;
  }
}

/**
 * Execute a custom tool
 */
export async function executeTool(
  toolId: string,
  agentId: string | null,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const startTime = Date.now();
    const supabase = await createClient();

    // Get the current implementation
    const { data: toolImpl, error: fetchError } = await supabase
      .from("current_tool_implementations")
      .select("*")
      .eq("tool_id", toolId)
      .single();

    if (fetchError || !toolImpl) {
      console.error("Error fetching tool implementation:", fetchError);
      return {
        success: false,
        error: "Tool implementation not found",
      };
    }

    let result: ToolResult;
    let success = true;
    let errorMessage: string | undefined;

    try {
      // Execute the tool code in a controlled environment
      // This is a simplified version - in production you'd use a more
      // secure execution environment with proper sandboxing
      const executeFunction = new Function(
        "agentId",
        "args",
        `
        try {
          ${toolImpl.execute_code}
        } catch (error) {
          return {
            success: false,
            data: \`Error executing tool: \${error.message}\`,
            type: "markdown"
          };
        }
        `
      ) as (
        agentId: string,
        args: Record<string, unknown>
      ) => Promise<ToolResult>;

      result = await executeFunction(agentId || "direct-execution", args);
    } catch (execError: unknown) {
      console.error("Error executing custom tool:", execError);
      success = false;
      errorMessage =
        execError instanceof Error
          ? execError.message
          : "Unknown execution error";
      result = {
        success: false,
        data: `Failed to execute tool: ${errorMessage}`,
        type: "markdown",
      };
    }

    const executionTime = Date.now() - startTime;

    // Log the execution
    await supabase.from("custom_tool_executions").insert({
      tool_id: toolId,
      implementation_id: toolImpl.implementation_id,
      agent_id: agentId,
      input_args: args,
      output_result: result,
      success,
      error_message: errorMessage,
      execution_time_ms: executionTime,
    });

    return {
      success,
      result,
      error: errorMessage,
      executionTime,
    };
  } catch (error: unknown) {
    console.error("Unexpected error in tool execution:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error during tool execution",
    };
  }
}

/**
 * Build a tool input schema from the stored JSON format
 */
export function buildInputSchema(
  schema: Record<string, unknown>
): ToolInputSchema {
  // This would convert our stored schema format to a Zod schema at runtime
  // A simplified example is shown here
  const properties: Record<string, ToolInputField> = {};
  const required: string[] = [];

  if (schema.properties && typeof schema.properties === "object") {
    for (const [name, fieldValue] of Object.entries(schema.properties)) {
      const field = fieldValue as Record<string, unknown>;

      // Create the field definition
      const fieldDef: ToolInputField = {
        type: typeof field.type === "string" ? field.type : "string",
        description:
          typeof field.description === "string" ? field.description : "",
        required: Boolean(field.required),
      };

      // Add optional properties if they exist
      if (typeof field.minimum === "number") {
        fieldDef.minimum = field.minimum;
      }

      if (typeof field.maximum === "number") {
        fieldDef.maximum = field.maximum;
      }

      if (Array.isArray(field.enum)) {
        fieldDef.enum = field.enum.filter(
          (item) => typeof item === "string"
        ) as string[];
      }

      if (field.default !== undefined) {
        fieldDef.default = field.default;
      }

      // Add to properties
      properties[name] = fieldDef;

      // Add to required list if needed
      if (fieldDef.required) {
        required.push(name);
      }
    }
  }

  return {
    properties,
    required,
    additionalProperties: false,
  };
}
