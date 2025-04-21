import { createClient } from "@/utils/supabase/server";
import axios from "axios";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Extract the message and agentId from the request body and validate
    const { message, agentId } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (!agentId) {
      return NextResponse.json(
        { error: "Agent ID is required" },
        { status: 400 }
      );
    }

    // Get user ID from auth session
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const response = await axios.post(
      `http://localhost:3800/api/agents/${agentId}/chat`,
      {
        message,
      },
      {
        headers: {
          "x-user-id": userId || "",
        },
      }
    );

    if (response.status !== 200) {
      return NextResponse.json(
        { error: `Failed to send message: ${response.data}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
