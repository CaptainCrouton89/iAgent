import {
  deleteCustomTool,
  getCustomToolWithImplementation,
  updateCustomTool,
} from "@/lib/actions/customTools";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET: Get a single tool with its current implementation
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user ID from session
    const userId = session.user.id;

    // Get the tool with its implementation
    const toolWithImplementation = await getCustomToolWithImplementation(
      params.id,
      supabase
    );

    // Check if tool exists
    if (!toolWithImplementation) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Check if user owns the tool
    if (toolWithImplementation.tool.owner !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json(toolWithImplementation);
  } catch (error) {
    console.error("Error fetching tool:", error);
    return NextResponse.json(
      { error: "Failed to fetch tool" },
      { status: 500 }
    );
  }
}

// PUT: Update a tool and its implementation
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user ID from session
    const userId = session.user.id;

    // Get the tool first to check ownership
    const toolWithImplementation = await getCustomToolWithImplementation(
      params.id,
      supabase
    );

    // Check if tool exists
    if (!toolWithImplementation) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Check if user owns the tool
    if (toolWithImplementation.tool.owner !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get request body
    const formData = await req.json();

    // Validate required fields
    const requiredFields = [
      "name",
      "description",
      "input_schema",
      "execute_code",
    ];
    for (const field of requiredFields) {
      if (!formData[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Update the tool
    const updatedTool = await updateCustomTool(params.id, formData, supabase);

    return NextResponse.json(updatedTool);
  } catch (error) {
    console.error("Error updating tool:", error);
    return NextResponse.json(
      { error: "Failed to update tool" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a tool
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user ID from session
    const userId = session.user.id;

    // Get the tool first to check ownership
    const { data: tool, error } = await supabase
      .from("custom_tools")
      .select("owner")
      .eq("id", params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Check if user owns the tool
    if (tool.owner !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete the tool
    await deleteCustomTool(params.id, supabase);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tool:", error);
    return NextResponse.json(
      { error: "Failed to delete tool" },
      { status: 500 }
    );
  }
}
