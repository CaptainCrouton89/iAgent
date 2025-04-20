import axios from "axios";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
};

type AgentResponse = {
  agent: {
    id: string;
    title: string;
    // other agent properties
  };
  messageHistory: Message[];
};

export async function GET(request: Request) {
  // Get the agent ID from the request's URL
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return new Response(JSON.stringify({ error: "Agent ID is required" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const encoder = new TextEncoder();

  // Create a TransformStream for handling the Server-Sent Events
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Function to send event to the client
  const sendEvent = async <T>(eventType: string, data: T) => {
    const stringData = JSON.stringify(data);
    await writer.write(
      encoder.encode(`event: ${eventType}\ndata: ${stringData}\n\n`)
    );
  };

  // Send an initial ping to establish the connection
  const sendInitialPing = async () => {
    // Send an initial empty array to establish the connection
    await sendEvent<{ connected: boolean }>("connected", { connected: true });
  };

  // Immediately start the connection by sending initial headers
  const startPolling = async () => {
    try {
      // Send initial ping to establish the connection
      await sendInitialPing();

      // Track last response to avoid sending duplicate data
      let lastResponseHash = "";

      // Poll for new messages
      while (true) {
        try {
          const response = await axios.get(
            `http://localhost:3800/api/agents/${agentId}/messages`
          );

          if (response.status === 200) {
            const agentData = response.data as AgentResponse;

            // Check if messageHistory exists
            if (
              agentData.messageHistory &&
              Array.isArray(agentData.messageHistory)
            ) {
              // Only send if the data has changed
              const currentHash = JSON.stringify(agentData.messageHistory);

              if (currentHash !== lastResponseHash) {
                // Send the entire message history
                await sendEvent<Message[]>(
                  "messages",
                  agentData.messageHistory
                );

                // Update hash
                lastResponseHash = currentHash;
              }
            } else {
              // Send empty array if no messages
              await sendEvent<Message[]>("messages", []);
              console.error("Invalid response format:", agentData);
            }
          }
        } catch (error) {
          console.error("Error fetching messages:", error);
          // On error, send ping to keep the connection alive
          await sendEvent<{ error: boolean }>("error", { error: true });
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error("Stream error:", error);
      // Check if the writer is not closed before attempting to close it
      if (!writer.closed) {
        await writer.close();
      }
    }
  };

  // Start the polling process without awaiting it
  startPolling();

  // Return the response with appropriate headers for SSE
  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
