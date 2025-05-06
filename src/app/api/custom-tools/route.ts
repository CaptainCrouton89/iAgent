import { createCustomTool, getCustomTools } from "@/lib/actions/customTools";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET: List all custom tools for the current user
export async function GET() {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all custom tools
    const tools = await getCustomTools(supabase);

    return NextResponse.json(tools);
  } catch (error) {
    console.error("Error fetching custom tools:", error);
    return NextResponse.json(
      { error: "Failed to fetch custom tools" },
      { status: 500 }
    );
  }
}

// POST: Create a new custom tool
export async function POST(req: NextRequest) {
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

    // Create the tool
    const tool = await createCustomTool(formData, supabase);

    return NextResponse.json(tool, { status: 201 });
  } catch (error) {
    console.error("Error creating custom tool:", error);
    return NextResponse.json(
      { error: "Failed to create custom tool" },
      { status: 500 }
    );
  }
}
