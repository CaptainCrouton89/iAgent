import { saveConversation } from "@/actions/memory-chat";
import { Message } from "@ai-sdk/react";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid request: messages must be an array" },
        { status: 400 }
      );
    }

    const result = await saveConversation(messages as Message[]);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to save conversation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving memory:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
