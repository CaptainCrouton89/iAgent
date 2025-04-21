import { deleteAgent } from "@/lib/actions/agents";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  try {
    const agentId = request.nextUrl.searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json(
        { error: "Agent ID is required" },
        { status: 400 }
      );
    }

    // Get supabase client and authenticate user
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Delete the agent
    await deleteAgent(agentId, supabase);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting agent:", error);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}
