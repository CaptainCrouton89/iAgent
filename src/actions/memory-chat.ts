"use server";

import { createClient } from "@/utils/supabase/server";
import { Message } from "@ai-sdk/react";
import { revalidatePath } from "next/cache";
import OpenAI from "openai";

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function saveConversation(messages: Message[]) {
  try {
    const supabase = await createClient();

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    // Convert messages to a string for embedding
    const rawContent = messages
      .map(
        (msg) =>
          `${msg.role}: ${
            msg.parts
              ?.map((part) =>
                part.type === "text"
                  ? part.text
                  : part.type === "tool-invocation"
                  ? `[Tool: ${part.toolInvocation.toolName}]`
                  : ""
              )
              .join(" ") || ""
          }`
      )
      .join("\n");

    // Generate embedding using OpenAI
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: rawContent.slice(0, 8000), // Limit to 8000 chars to avoid token limits
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Save to Supabase
    const { error } = await supabase.from("memories").insert({
      content: rawContent,
      embedding,
    });

    if (error) {
      throw error;
    }

    revalidatePath("/private/memory-chat");

    return { success: true };
  } catch (error) {
    console.error("Error saving conversation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
