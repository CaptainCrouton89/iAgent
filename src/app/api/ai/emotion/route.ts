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
  // Filter out non-text messages and take only the last 3
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
        JSON.stringify({ emotion: "Neutral" }), // Default if no messages
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const processedMessages = processMessages(messages);

    // If no valid text messages found, return neutral
    if (processedMessages.length === 0) {
      return new Response(JSON.stringify({ emotion: "Neutral" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
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

    const { object } = await generateObject({
      model: openai("gpt-4.1-nano"),
      system: EMOTION_SYSTEM_PROMPT,
      prompt: conversationString,
      maxTokens: 1000,
      temperature: 0.4,
      schema: z.object({
        emotion: z.string().describe("The emotion Sam would likely feel"),
      }),
    });

    console.log("detectedEmotion", JSON.stringify(object, null, 2));

    return new Response(
      JSON.stringify({
        emotion: object.emotion || "Neutral",
      }), // Remove potential quotes
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in emotion route:", error);
    // Fallback to neutral on error
    return new Response(JSON.stringify({ emotion: "Neutral" }), {
      status: 500, // Internal Server Error but still provide a fallback emotion
      headers: { "Content-Type": "application/json" },
    });
  }
}
