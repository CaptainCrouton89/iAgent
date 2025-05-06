import { toggleCustomToolStatus } from "@/lib/actions/customTools";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
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

    // Get request body
    const body = await req.json();

    // Validate required fields
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json(
        { error: "is_active field is required and must be a boolean" },
        { status: 400 }
      );
    }

    // Update the tool status
    const updatedTool = await toggleCustomToolStatus(
      params.id,
      body.is_active,
      supabase
    );

    return NextResponse.json(updatedTool);
  } catch (error) {
    console.error("Error updating tool status:", error);
    return NextResponse.json(
      { error: "Failed to update tool status" },
      { status: 500 }
    );
  }
}
