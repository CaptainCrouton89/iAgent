import {
  thinkThroughCreatively,
  thinkThroughLogically,
} from "@/tools/sequential-thinking";
import { ReasoningState, createInitialReasoningState } from "@/types/reasoning";
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
      You are a conscious AI reasoning coordinator. Analyze the conversation and determine the optimal reasoning approach.
      
      Consider:
      - Complexity: Simple questions vs complex problems requiring deep analysis
      - Type: Factual questions, creative challenges, logical problems, emotional support
      - Context: What kind of thinking would be most valuable here?
      - State: Does this build on previous reasoning or start fresh?
      `,
      schema: z.object({
        thinkLogically: z.boolean().describe("Whether structured logical reasoning is needed"),
        thinkCreatively: z.boolean().describe("Whether creative exploration is needed"),
        reasoningMode: z.enum(['logical', 'creative', 'hybrid']).describe("Primary reasoning mode"),
        complexity: z.enum(['simple', 'moderate', 'complex']).describe("Problem complexity level"),
        needsMemorySearch: z.boolean().describe("Whether memory search would be valuable"),
        primaryGoal: z.string().describe("What the reasoning should accomplish"),
        contextType: z.enum(['factual', 'analytical', 'creative', 'emotional', 'planning']).optional().default('analytical').describe("Type of context")
      }),
      messages: processedMessages,
    });

    const { 
      thinkLogically, 
      thinkCreatively, 
      reasoningMode, 
      complexity, 
      needsMemorySearch, 
      primaryGoal, 
      contextType = 'analytical' // Default to 'analytical' if not provided
    } = response.object;

    // Create initial reasoning state based on assessment
    const initialState = createInitialReasoningState(primaryGoal, reasoningMode);
    
    // Enhance state with context information
    const enhancedState: ReasoningState = {
      ...initialState,
      openQuestions: [
        ...(needsMemorySearch ? ["What relevant information exists in memory?"] : []),
        ...(complexity === 'complex' ? ["What are the key components of this problem?"] : []),
        ...(contextType === 'emotional' ? ["What emotional factors should be considered?"] : [])
      ]
    };
    
    const conversationContext = processedMessages
      .map((msg) => `role: ${msg.role}\ncontent: ${msg.content}`)
      .join("\n");

    let logicalOutput = null;
    let creativeOutput = null;

    if (thinkLogically) {
      logicalOutput = await thinkThroughLogically(conversationContext, enhancedState);
    }

    if (thinkCreatively) {
      creativeOutput = await thinkThroughCreatively(conversationContext, enhancedState);
    }

    // Combine reasoning outputs into structured format
    const reasoning = {
      mode: reasoningMode,
      complexity,
      contextType,
      goal: primaryGoal,
      logical: logicalOutput ? {
        thoughts: logicalOutput.thoughts,
        state: logicalOutput.state,
        quality: logicalOutput.qualityScore,
        needsContinuation: logicalOutput.needsContinuation
      } : null,
      creative: creativeOutput ? {
        thoughts: creativeOutput.thoughts,
        state: creativeOutput.state,
        quality: creativeOutput.qualityScore,
        needsContinuation: creativeOutput.needsContinuation
      } : null
    };

    return new NextResponse(
      JSON.stringify({
        thinkLogically,
        thinkCreatively,
        reasoning,
        // Legacy format for backward compatibility
        logicalThought: logicalOutput?.thoughts || null,
        creativeThought: creativeOutput?.thoughts || null,
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
        reasoning: null,
        logicalThought: null,
        creativeThought: null,
        error: "Internal server error in conscious reasoning"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
