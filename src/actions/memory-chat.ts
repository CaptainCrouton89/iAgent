"use server";

import { createClient } from "@/utils/supabase/server";
import { openai } from "@ai-sdk/openai";
import { Message } from "@ai-sdk/react";
import { generateObject, generateText } from "ai";
import { revalidatePath } from "next/cache";
import OpenAI from "openai";
import { z } from "zod";

// Initialize OpenAI client for embeddings
const openaiEmbeddings = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CompressedMessage {
  role: string;
  content: string;
}

// Schema for title and summary generation
const titleSummarySchema = z.object({
  title: z
    .string()
    .describe("A concise, descriptive title for the conversation"),
  summary: z
    .string()
    .describe("A 1-2 sentence summary of the conversation content"),
});

// Function to generate title and summary for a conversation
async function generateTitleAndSummary(
  messages: Message[]
): Promise<{ title: string; summary: string }> {
  try {
    // Extract text content from messages for analysis
    const conversationText = messages
      .map((msg) => {
        if (msg.parts) {
          const textContent = msg.parts
            .map((part) => (part.type === "text" ? part.text : ""))
            .filter((text) => text.trim())
            .join(" ");
          return textContent ? `${msg.role}: ${textContent}` : "";
        }
        return msg.content ? `${msg.role}: ${msg.content}` : "";
      })
      .filter((line) => line.trim())
      .join("\n");

    if (!conversationText.trim()) {
      return {
        title: "Conversation",
        summary: "A conversation between user and assistant.",
      };
    }

    const { object } = await generateObject({
      model: openai("gpt-4.1-mini"),
      schema: titleSummarySchema,
      prompt: `Analyze this conversation and generate a title and summary:\n\n${conversationText}`,
      system:
        "You are analyzing a conversation to create a meaningful title and brief summary. The title should be concise and descriptive. The summary should be 1-2 sentences capturing the main topics or themes discussed.",
      temperature: 0.3,
    });

    return object;
  } catch (error) {
    console.error("Error generating title and summary:", error);
    return {
      title: "Conversation",
      summary: "A conversation between user and assistant.",
    };
  }
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

    // Prepare summarization tasks for parallel processing
    const summarizationTasks = originalMessages
      .map((msg, index) => {
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
          return {
            index,
            msg,
            messageTextToProcess,
            task: generateText({
              system:
                "You are a helpful assistant that summarizes text, compressing it into an informationally dense summary with maximum specificity and minimum words. Use sentence fragments if appropriate. Respond only with the compressed text, no other text.",
              model: openai("gpt-4.1-nano"),
              prompt: `Text: ${messageTextToProcess}`,
            }),
          };
        }
        return null;
      })
      .filter((task): task is NonNullable<typeof task> => task !== null);

    // Execute all summarization tasks in parallel
    const summarizationResults = await Promise.allSettled(
      summarizationTasks.map((task) => task.task)
    );

    // Process results in original order
    for (let i = 0; i < summarizationTasks.length; i++) {
      const { msg, messageTextToProcess } = summarizationTasks[i];
      const result = summarizationResults[i];

      if (result.status === "fulfilled") {
        const summarizedText = result.value.text;
        compressedConversationPayload.push({
          role: msg.role,
          content: summarizedText,
        });
        embeddingSourceMaterial.push(`${msg.role}: ${summarizedText}`);
      } else {
        console.error(
          `Error summarizing message part for msg id ${msg.id}:`,
          result.reason
        );
        embeddingSourceMaterial.push(`${msg.role}: ${messageTextToProcess}`);
      }
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

    // Generate title and summary for the conversation
    const { title, summary } = await generateTitleAndSummary(originalMessages);

    const { error } = await supabase.from("memories").insert({
      content: originalMessages,
      compressed_conversation: compressedConversationPayload,
      embedding, // This can be null if no content was embeddable
      title,
      summary,
      auth_id: user.id,
      created_at: new Date().toISOString(), // Store in UTC (this is correct)
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
