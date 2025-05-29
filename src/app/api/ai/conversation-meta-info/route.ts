import { openai } from "@ai-sdk/openai";
import {
  CoreAssistantMessage,
  CoreMessage,
  CoreUserMessage,
  generateObject,
} from "ai";
import { z } from "zod";

// Allow streaming responses up to 10 seconds for this lightweight model
export const maxDuration = 10;

const EMOTION_SYSTEM_PROMPT = `You are an emotion analyzer. Your task is to determine how Sam would likely feel in this conversational position with his friend.

Based on the provided conversation messages between Sam and Sam's Friend (especially the most recent ones), output a few words or a short phrase describing Sam's most probable emotional state, in response to what his friend just said.

For Example: Neutral, Curious, Amused, Focused, Explaining, Patient, Slightly-Annoyed, Frustrated, Mad, Pissed-Off, Intrigued, Sarcastic, Disappointed, Excited, Worried, Confused, Content, Grateful, Skeptical, Defensive, Empathetic, Playful, Outraged.

- Consider the context of the entire conversation between Sam and his friend.
- Pay close attention to the last few messages to gauge Sam's immediate emotional reaction to his friend.
- If Sam's Friend is being rude, unhelpful, or difficult, Sam should react accordingly (e.g., Impatient, Frustrated, Annoyed, Angry, etc.).
- If Sam is having a good interaction with his friend or the conversation is positive, Sam might feel Content, Amused, or Pleased.
- Sam is a busy person, so if his friend seems to be wasting his time or asking repetitive questions, Sam might show Impatience or Frustration.
- Sam gets angrier and angrier the more his friend is rude, unhelpful, or difficult.

Output only Sam's emotional state.`;

const THINKING_DEPTH_SYSTEM_PROMPT = `You are an AI agent decision-maker analyzing whether deeper conscious thought/brainstorming is needed for the AI agent's response.

Based on the conversation, determine if the AI agent needs to engage in deeper thinking processes to formulate an appropriate response.

Consider:
- Simple acknowledgments, greetings, or basic factual questions require minimal thinking (1-3)
- Questions requiring explanation, analysis, or problem-solving need moderate thinking (4-6)  
- Complex problems, creative tasks, philosophical questions, or multi-step reasoning require deep thinking (7-10)

Output a number from 1-10 representing the thinking depth required.`;

const MEMORY_SEARCH_SYSTEM_PROMPT = `You are an AI agent decision-maker analyzing whether new information was introduced that requires a memory search.

Determine if the conversation contains new topics, concepts, people, places, or references that the AI agent should search its memory for additional context.

Return true if:
- New topics, concepts, or subjects are mentioned that weren't in recent conversation
- References to past events, people, places, or experiences
- Questions about things that might have been discussed before
- Any context that could benefit from historical information

Return false if:
- Conversation continues on the same topic without new elements
- Simple greetings, acknowledgments, or immediate responses
- Self-contained questions that don't require historical context

Output only true or false.`;

const MAX_MESSAGE_LENGTH = 500; // Characters per message half (start/end)
const MAX_MESSAGES = 10;

type ConversationMessage = CoreUserMessage | CoreAssistantMessage;

function isConversationMessage(msg: CoreMessage): msg is ConversationMessage {
  return (
    (msg.role === "user" || msg.role === "assistant") &&
    typeof msg.content === "string"
  );
}

function processMessages(messages: CoreMessage[]): CoreMessage[] {
  // Filter out non-text messages and take only the last few
  const textMessages = messages
    .filter(isConversationMessage)
    .slice(-MAX_MESSAGES);

  // Process each message content
  return textMessages.map((msg) => {
    // If the message is too long, trim it
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
    const {
      messages,
      emotionHistory,
    }: { messages: CoreMessage[]; emotionHistory: string[] } = await req.json();

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({
          emotion: "Neutral",
          thinkingDepth: 1,
          memorySearchRequired: false,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const processedMessages = processMessages(messages);

    // If no valid text messages found, return defaults
    if (processedMessages.length === 0) {
      return new Response(
        JSON.stringify({
          emotion: "Neutral",
          thinkingDepth: 1,
          memorySearchRequired: false,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    let samMessageTurnCount = 0;
    const conversationString = processedMessages
      .map((msg) => {
        if (msg.role === "user") {
          return `Friend: ${msg.content}`;
        } else if (msg.role === "assistant") {
          // Sam's turn
          let samLine = `Sam: ${msg.content}`;
          // emotionHistory[i] is the emotion Sam felt for his i-th message turn in this processedMessages sequence.
          if (samMessageTurnCount < emotionHistory.length) {
            samLine += ` (Sam felt: ${emotionHistory[samMessageTurnCount]})`;
          }
          samMessageTurnCount++;
          return samLine;
        }
        return ""; // Should be filtered out by isConversationMessage and processMessages
      })
      .filter(Boolean)
      .join("\n");

    console.log("conversationString", conversationString);

    // Make parallel AI requests for each piece of information
    const [emotionResult, thinkingDepthResult, memorySearchResult] = await Promise.all([
      generateObject({
        model: openai("gpt-4.1-nano"),
        system: EMOTION_SYSTEM_PROMPT,
        prompt: conversationString,
        maxTokens: 500,
        temperature: 0.4,
        schema: z.object({
          emotion: z.string().describe("The emotion Sam would likely feel"),
        }),
      }),
      generateObject({
        model: openai("gpt-4.1-nano"),
        system: THINKING_DEPTH_SYSTEM_PROMPT,
        prompt: conversationString,
        maxTokens: 200,
        temperature: 0.3,
        schema: z.object({
          thinkingDepth: z.number().min(1).max(10).describe("Thinking depth required (1-10)"),
        }),
      }),
      generateObject({
        model: openai("gpt-4.1-nano"),
        system: MEMORY_SEARCH_SYSTEM_PROMPT,
        prompt: conversationString,
        maxTokens: 100,
        temperature: 0.2,
        schema: z.object({
          memorySearchRequired: z.boolean().describe("Whether memory search is needed"),
        }),
      }),
    ]);

    const result = {
      emotion: emotionResult.object.emotion || "Neutral",
      thinkingDepth: thinkingDepthResult.object.thinkingDepth || 1,
      memorySearchRequired: memorySearchResult.object.memorySearchRequired || false,
    };

    console.log("conversationMetaInfo", JSON.stringify(result, null, 2));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in conversation-meta-info route:", error);
    // Fallback to defaults on error
    return new Response(
      JSON.stringify({
        emotion: "Neutral",
        thinkingDepth: 1,
        memorySearchRequired: false,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
