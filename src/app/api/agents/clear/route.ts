import { createClient } from "@/utils/supabase/server";
import axios from "axios";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  // Get the agent ID from the request's URL
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return NextResponse.json(
      { error: "Agent ID is required" },
      { status: 400 }
    );
  }

  try {
    // Get user ID from auth session
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const response = await axios.delete(
      `http://localhost:3800/api/agents/${agentId}/messages`,
      {
        headers: {
          "x-user-id": userId || "",
        },
      }
    );

    if (response.status !== 200) {
      return NextResponse.json(
        { error: `Failed to clear message history: ${response.data}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing message history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
