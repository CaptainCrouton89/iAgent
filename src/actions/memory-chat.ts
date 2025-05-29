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

// Schema for memory metadata generation
const memoryMetadataSchema = z.object({
  title: z
    .string()
    .describe("A concise, descriptive title for the conversation"),
  summary: z
    .string()
    .describe("A 1-2 sentence summary of the conversation content"),
  label: z
    .enum([
      "important",
      "user_profile",
      "general",
      "temporary",
      "trivial",
    ])
    .describe(
      "Category for the memory based on content importance and type"
    ),
  strength: z
    .number()
    .min(0)
    .max(1)
    .describe("Initial strength score based on conversation quality (0.0-1.0)"),
  pinned: z
    .boolean()
    .describe("Whether this memory should be permanently retained"),
  reasoning: z
    .string()
    .describe("Brief explanation for the metadata choices"),
});

// Function to generate memory metadata for a conversation
async function generateMemoryMetadata(
  messages: Message[],
  usedMemoryIds?: string[]
): Promise<{
  title: string;
  summary: string;
  label: string;
  strength: number;
  pinned: boolean;
}> {
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
        label: "general",
        strength: 0.5,
        pinned: false,
      };
    }

    const { object } = await generateObject({
      model: openai("gpt-4.1-mini"),
      schema: memoryMetadataSchema,
      prompt: `Analyze this conversation and generate metadata:\n\n${conversationText}\n\nPrevious memories used: ${usedMemoryIds ? usedMemoryIds.length : 0}`,
      system: `You are analyzing a conversation to create comprehensive memory metadata.

Label Guidelines:
- "important": Core user information, critical decisions, key facts about the user
- "user_profile": Personal information, preferences, habits, names, relationships
- "general": Default for standard conversations with moderate value
- "temporary": Time-sensitive information, transient context that won't be relevant long-term
- "trivial": Small talk, low-value exchanges with no lasting importance

Strength Calculation (0.0-1.0):
- Base: 0.5 for standard conversations
- Boost to 0.7-0.9 for: Questions answered, problems solved, new information learned about user
- Reduce to 0.3-0.4 for: Repetitive content, small talk, no clear outcome

Auto-pin when:
- User's name is first mentioned
- Key personal identifiers (email, phone, address)
- Explicitly marked important information
- Core preferences that affect all future interactions`,
      temperature: 0.3,
    });

    const { reasoning, ...metadata } = object;
    console.log("Generated memory metadata:", metadata, "Reasoning:", reasoning);
    return metadata;
  } catch (error) {
    console.error("Error generating title and summary:", error);
    return {
      title: "Conversation",
      summary: "A conversation between user and assistant.",
      label: "general",
      strength: 0.5,
      pinned: false,
    };
  }
}

export async function saveConversation(
  originalMessages: Message[],
  usedMemoryIds?: string[]
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    // Generate comprehensive metadata for the conversation first to determine if compression is needed
    const { title, summary, label, strength, pinned } =
      await generateMemoryMetadata(originalMessages, usedMemoryIds);

    const compressedConversationPayload: CompressedMessage[] = [];
    const embeddingSourceMaterial: string[] = [];

    // Only compress if conversation is classified as more advanced than "trivial" or "general"
    const shouldCompress = label === "important" || label === "user_profile";

    if (shouldCompress) {
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
    } else {
      // For trivial/general/temporary conversations, use original content without compression
      originalMessages.forEach((msg) => {
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

        if (messageTextToProcess || msg.content) {
          const content = messageTextToProcess || msg.content || "";
          compressedConversationPayload.push({
            role: msg.role,
            content: content,
          });
          embeddingSourceMaterial.push(`${msg.role}: ${content}`);
        }
      });
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
      title,
      summary,
      label,
      strength,
      pinned,
      last_used: new Date().toISOString(), // Initialize to creation time
      auth_id: user.id,
      created_at: new Date().toISOString(), // Store in UTC (this is correct)
    });

    if (error) {
      throw error;
    }

    // Update used memories if any were provided
    if (usedMemoryIds && usedMemoryIds.length > 0) {
      // Boost strength and update last_used for memories that were actually used
      const updatePromises = usedMemoryIds.map(async (memoryId) => {
        // First get the current strength
        const { data: memory } = await supabase
          .from("memories")
          .select("strength")
          .eq("id", memoryId)
          .eq("auth_id", user.id)
          .single();

        if (memory) {
          // Update with boosted strength (capped at 1.0)
          return supabase
            .from("memories")
            .update({
              last_used: new Date().toISOString(),
              strength: Math.min(1.0, (memory.strength || 0.5) + 0.1),
            })
            .eq("id", memoryId)
            .eq("auth_id", user.id);
        }
      });

      await Promise.all(updatePromises).catch((error) => {
        console.error("Error updating used memories:", error);
      });
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
