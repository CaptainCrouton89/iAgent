"use server";

import { createClient } from "@/utils/supabase/server";
import { openai as vercelOpenAI } from "@ai-sdk/openai";
import { Message } from "@ai-sdk/react";
import { generateText } from "ai";
import { revalidatePath } from "next/cache";
import OpenAI from "openai";

// Initialize OpenAI client for embeddings
const openaiEmbeddings = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CompressedMessage {
  role: string;
  content: string;
}

export async function saveConversation(originalMessages: Message[]) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const compressedConversationPayload: CompressedMessage[] = [];
    const embeddingSourceMaterial: string[] = [];

    for (const msg of originalMessages) {
      // Process only text parts for summarization and embedding
      const messageTextToProcess = msg.parts
        ?.map((part) => {
          if (part.type === "text") {
            return part.text.trim();
          }
          return null;
        })
        .filter((text): text is string => text !== null && text !== "")
        .join(" ")
        .trim();

      if (messageTextToProcess) {
        try {
          const { text: summarizedText } = await generateText({
            system:
              "You are a helpful assistant that summarizes text, compressing it into an informationally dense summary with maximum specificity and minimum words. Use sentence fragments if appropriate. Respond only with the compressed text, no other text.",
            model: vercelOpenAI("gpt-4.1-nano"),
            prompt: `Text: ${messageTextToProcess}`,
          });
          compressedConversationPayload.push({
            role: msg.role,
            content: summarizedText,
          });
          embeddingSourceMaterial.push(`${msg.role}: ${summarizedText}`);
        } catch (summaryError) {
          console.error(
            `Error summarizing message part for msg id ${msg.id}:`,
            summaryError
          );
          embeddingSourceMaterial.push(`${msg.role}: ${messageTextToProcess}`);
        }
      }
      // Tool invocations and messages without text are now implicitly excluded from both
      // compressedConversationPayload and embeddingSourceMaterial
    }

    const contentForEmbedding = embeddingSourceMaterial.join("\\n");

    let embedding = null;
    if (contentForEmbedding.trim()) {
      const embeddingResponse = await openaiEmbeddings.embeddings.create({
        model: "text-embedding-ada-002",
        input: contentForEmbedding.slice(0, 8000),
      });
      embedding = embeddingResponse.data[0].embedding;
    } else {
      console.log(
        "No content available for embedding after processing messages."
      );
    }

    const { error } = await supabase.from("memories").insert({
      content: originalMessages,
      compressed_conversation: compressedConversationPayload,
      embedding, // This can be null if no content was embeddable
      auth_id: user.id,
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
