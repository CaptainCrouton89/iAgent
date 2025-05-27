import {
  getCustomToolWithImplementation,
  recordToolExecution,
} from "@/lib/actions/customTools";
import { Json } from "@/utils/supabase/database.types";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface ToolRequestBody {
  tool_id: string;
  agent_id?: string | null;
  args?: Record<string, unknown>;
}

// POST: Execute a custom tool
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let implementationId: string | null = null;
  let parsedBody: ToolRequestBody = { tool_id: "" };

  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get request body
    parsedBody = (await req.json()) as ToolRequestBody;

    // Validate required fields
    if (!parsedBody.tool_id) {
      return NextResponse.json(
        { error: "tool_id is required" },
        { status: 400 }
      );
    }

    // Get the tool with its implementation
    const toolData = await getCustomToolWithImplementation(
      parsedBody.tool_id,
      supabase
    );

    if (!toolData) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    if (!toolData.tool.is_active) {
      return NextResponse.json(
        { error: "This tool is inactive" },
        { status: 400 }
      );
    }

    implementationId = toolData.implementation.id;

    // Set up a controlled environment for code execution
    const executeFunction = new Function(
      "agentId",
      "args",
      toolData.implementation.execute_code
    );

    // Execute the tool code
    const result = await executeFunction(
      parsedBody.agent_id || null,
      parsedBody.args || {}
    );

    // Calculate execution time
    const executionTimeMs = Date.now() - startTime;

    // Record the execution
    await recordToolExecution(
      parsedBody.tool_id,
      implementationId!,
      parsedBody.agent_id || null,
      (parsedBody.args as Json) || {},
      result,
      true,
      null,
      executionTimeMs,
      supabase
    );

    return NextResponse.json({
      success: true,
      data: result,
      execution_time_ms: executionTimeMs,
    });
  } catch (error) {
    // Calculate execution time even for errors
    const executionTimeMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";

    console.error("Error executing tool:", error);

    // Record the failed execution if we know the implementation ID
    if (implementationId) {
      try {
        const supabase = await createClient();
        await recordToolExecution(
          parsedBody.tool_id,
          implementationId,
          parsedBody.agent_id || null,
          (parsedBody.args as Json) || {},
          null,
          false,
          errorMessage,
          executionTimeMs,
          supabase
        );
      } catch (recordError) {
        console.error("Error recording tool execution:", recordError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        execution_time_ms: executionTimeMs,
      },
      { status: 500 }
    );
  }
}
