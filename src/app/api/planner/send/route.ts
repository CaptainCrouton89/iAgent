import axios from "axios";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Extract the message from request
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const response = await axios.post(
      "http://localhost:3800/api/agents/9ec76e34-9715-4310-89d0-d9663373b02a/chat",
      {
        message,
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
