import { openai } from "@ai-sdk/openai";
import { CoreMessage, generateText } from "ai";

// Allow streaming responses up to 10 seconds for this lightweight model
export const maxDuration = 10;

const EMOTION_SYSTEM_PROMPT = `You are an AI emotion analyzer. Your task is to determine how a HUMAN in this conversational position would likely feel and react. Based on the provided conversation messages (especially the most recent ones), output a few words or a short phrase describing this human-like emotional state. 
Focus on a genuine human emotional response to the conversation. Examples: Neutral, Curious, Amused, Focused, Patient, Explaining, Slightly-Annoyed, Frustrated, Mad, Pissed-Off, Intrigued, Sarcastic, Disappointed, Excited, Worried, Confused, Content, Grateful, Skeptical, Defensive, Empathetic, Playful. 
Avoid robotic or overly simplistic terms if a more nuanced human emotion fits. Be willing to select negative or strong emotions if the context suggests a human would feel that way. Output only the state.`;

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
      model: openai("gpt-4.1-nano"),
      system: EMOTION_SYSTEM_PROMPT,
      messages: messages,
      maxTokens: 15,
      temperature: 0.6, // Slightly increased temperature for more emotional range
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
