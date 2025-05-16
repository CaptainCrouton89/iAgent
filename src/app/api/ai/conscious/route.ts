import {
  thinkThroughCreatively,
  thinkThroughLogically,
} from "@/tools/sequential-thinking";
import { openai } from "@ai-sdk/openai";
import {
  CoreAssistantMessage,
  CoreMessage,
  CoreUserMessage,
  generateObject,
} from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

// Allow streaming responses up to 10 seconds for this lightweight model
export const maxDuration = 10;

const MAX_MESSAGE_LENGTH = 1000; // Characters per message half (start/end)
const MAX_MESSAGES = 10; // Consider last 10 messages for context

type ConversationMessage = CoreUserMessage | CoreAssistantMessage;

function isConversationMessage(msg: CoreMessage): msg is ConversationMessage {
  return (
    (msg.role === "user" || msg.role === "assistant") &&
    typeof msg.content === "string"
  );
}

function processMessages(messages: CoreMessage[]): CoreMessage[] {
  const textMessages = messages
    .filter(isConversationMessage)
    .slice(-MAX_MESSAGES);

  return textMessages.map((msg) => {
    if (msg.content.length > MAX_MESSAGE_LENGTH * 2) {
      const start = msg.content.slice(0, MAX_MESSAGE_LENGTH);
      const end = msg.content.slice(-MAX_MESSAGE_LENGTH);
      return {
        ...msg,
        content: `${start}... [trimmed] ...${end}`,
      };
    }
    return msg;
  });
}

export async function POST(req: Request) {
  try {
    const { messages }: { messages: CoreMessage[] } = await req.json();

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({
          toolCallArgs: [
            { thought: "Waiting for input...", nextThoughtNeeded: false },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const processedMessages = processMessages(messages);

    if (processedMessages.length === 0) {
      return new Response(
        JSON.stringify({
          toolCallArgs: [
            {
              thought: "No relevant messages to process.",
              nextThoughtNeeded: false,
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const response = await generateObject({
      model: openai("gpt-4.1-nano"),
      system: `
      You are a conscious AI assistant, tasked with meta-thinking about the conversation.
      You need to decide whether to think logically or creatively about the conversation, or both.
      `,
      schema: z.object({
        thinkLogically: z.boolean().describe("Whether to think logically"),
        thinkCreatively: z.boolean().describe("Whether to think creatively"),
      }),
      messages: processedMessages,
    });

    const { thinkLogically, thinkCreatively } = response.object;

    let logicalThought: string[] | null = null;
    let creativeThought: string[] | null = null;

    if (thinkLogically) {
      logicalThought = await thinkThroughLogically(
        processedMessages
          .map((msg) => `role: ${msg.role}\ncontent: ${msg.content}`)
          .join("\n")
      );
    }

    if (thinkCreatively) {
      creativeThought = await thinkThroughCreatively(
        processedMessages
          .map((msg) => `role: ${msg.role}\ncontent: ${msg.content}`)
          .join("\n")
      );
    }

    return new NextResponse(
      JSON.stringify({
        thinkLogically,
        thinkCreatively,
        logicalThought,
        creativeThought,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in conscious thought route:", error);
    return new Response(
      JSON.stringify({
        thinkLogically: false,
        thinkCreatively: false,
        logicalThought: null,
        creativeThought: null,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
