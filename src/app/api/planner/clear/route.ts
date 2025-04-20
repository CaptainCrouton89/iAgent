import axios from "axios";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    const response = await axios.delete(
      "http://localhost:3800/api/agents/9ec76e34-9715-4310-89d0-d9663373b02a/messages"
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
