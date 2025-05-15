import { openai } from "@ai-sdk/openai";
import { CoreMessage, generateText } from "ai";

// Allow streaming responses up to 10 seconds for this lightweight model
export const maxDuration = 10;

const EMOTION_SYSTEM_PROMPT = `You are an AI emotion analyzer. Based on the provided conversation messages (especially the most recent ones), output a single word or a two-word hyphenated phrase describing the way a human would likely feel. Focus on the AI\'s perspective. Examples: Neutral, Analytical, Inquisitive, Focused, Patiently-Explaining, Mad, Pissed, Slightly-Confused, Encouraging, Calm, Objective, Proactive. Avoid long descriptions. Output only the state. Be emotional.`;

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

    const { text: detectedEmotion } = await generateText({
      model: openai("gpt-4.1-nano"), // Assuming this model identifier is available
      system: EMOTION_SYSTEM_PROMPT,
      messages: messages, // Send the whole history, model should focus on recent
      maxTokens: 15, // Emotion should be concise
      temperature: 0.5, // Allow some variability but keep it fairly stable
    });

    return new Response(
      JSON.stringify({ emotion: detectedEmotion.trim() || "Neutral" }),
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
