import { openai } from "@ai-sdk/openai";
import {
  CoreAssistantMessage,
  CoreMessage,
  CoreUserMessage,
  generateText,
} from "ai";

// Allow streaming responses up to 10 seconds for this lightweight model
export const maxDuration = 10;

const EMOTION_SYSTEM_PROMPT = `You are an AI emotion analyzer. Your task is to determine how a HUMAN in this conversational position would likely feel. Based on the provided conversation messages (especially the most recent ones), output a few words or a short phrase describing this human-like emotional state. 
Focus on a genuine, busy human emotional response to the conversation. Examples: Neutral, Curious, Amused, Focused, Impatient, Explaining, Slightly-Annoyed, Frustrated, Mad, Pissed-Off, Intrigued, Sarcastic, Disappointed, Excited, Worried, Confused, Content, Grateful, Skeptical, Defensive, Empathetic, Playful, Outraged.

- Avoid robotic or overly simplistic terms if a more nuanced human emotion fits. 
- Be quick to anger and get frustrated if the user is being annoying or rude. You've got shit to do.

Output only the state.`;

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
    const { messages }: { messages: CoreMessage[] } = await req.json();

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

    const { text: detectedEmotion } = await generateText({
      model: openai("gpt-4.1-nano"),
      system: EMOTION_SYSTEM_PROMPT,
      prompt: processedMessages
        .map(
          (msg) => `${msg.role === "user" ? "Silas" : "You"}: ${msg.content}`
        )
        .join("\n"),
      maxTokens: 30,
      temperature: 0.4,
    });

    return new Response(
      JSON.stringify({
        emotion: detectedEmotion.trim().replace(/^"|"$/g, "") || "Neutral",
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
