"use server";

import { createClient } from "@/utils/supabase/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import OpenAI from "openai";

// Initialize OpenAI client for embeddings (same as episodic memories)
const openaiEmbeddings = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SemanticMemorySchema = z.object({
  memories: z.array(
    z.object({
      type: z.enum(["fact", "theme", "summary"]),
      content: z.string().describe("The extracted semantic memory content"),
      confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
      reasoning: z.string().describe("Why this is important to remember"),
    })
  ),
});

export async function extractSemanticMemories(
  episodicMemoryIds: string[],
  userId: string
) {
  const supabase = await createClient();

  // Fetch the episodic memories
  const { data: memories, error } = await supabase
    .from("memories")
    .select("id, compressed_conversation, title, summary, created_at")
    .in("id", episodicMemoryIds)
    .eq("auth_id", userId);

  if (error || !memories?.length) {
    throw new Error("Failed to fetch episodic memories");
  }

  // Prepare content for LLM analysis
  const conversationContent = memories
    .map((memory) => {
      const conversation = Array.isArray(memory.compressed_conversation)
        ? memory.compressed_conversation
            .map((msg: { role: string; content: string }) => `${msg.role}: ${msg.content}`)
            .join("\n")
        : "";
      return `Memory ${memory.id} (${memory.created_at}):\nTitle: ${
        memory.title || "Untitled"
      }\nSummary: ${memory.summary || "No summary"}\n${conversation}`;
    })
    .join("\n---\n");

  // Extract semantic memories using LLM
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    system: `You are analyzing episodic memories to extract semantic knowledge.
    
Extract facts, themes, and summaries that represent:
- Persistent truths about the user or their context
- Recurring patterns or themes
- Important generalizations

Focus on information that would be valuable across multiple conversations.
Avoid extracting:
- Specific events or timestamps
- One-time occurrences
- Conversational details

Each extracted memory should be self-contained and meaningful out of context.`,
    prompt: `Analyze these episodic memories and extract semantic knowledge:\n\n${conversationContent}`,
    schema: SemanticMemorySchema,
  });

  // Store semantic memories with deduplication
  const results = [];
  for (const memory of object.memories) {
    // Generate embedding for the semantic memory (using same model as episodic memories)
    const embeddingResponse = await openaiEmbeddings.embeddings.create({
      model: "text-embedding-ada-002",
      input: memory.content.slice(0, 8000),
    });
    const embedding = embeddingResponse.data[0].embedding;

    // Prepare provenance data
    const provenance = episodicMemoryIds.map((id) => ({
      episode_id: id,
      timestamp: new Date().toISOString(),
    }));

    // Use the upsert function to handle deduplication
    const { data, error } = await supabase.rpc("upsert_semantic_memory", {
      p_auth_id: userId,
      p_type: memory.type,
      p_content: memory.content,
      p_embedding: embedding,
      p_confidence: memory.confidence,
      p_provenance: provenance,
      p_similarity_threshold: 0.85,
    });

    if (!error && data) {
      results.push({
        id: data,
        type: memory.type,
        content: memory.content,
        confidence: memory.confidence,
        reasoning: memory.reasoning,
      });
    }
  }

  return results;
}

export async function searchSemanticMemories(
  query: string,
  options: {
    type?: "fact" | "theme" | "summary";
    threshold?: number;
    limit?: number;
  } = {}
) {
  const supabase = await createClient();
  const { type, threshold = 0.7, limit = 10 } = options;

  // Generate embedding for the query
  const embeddingResponse = await openaiEmbeddings.embeddings.create({
    model: "text-embedding-ada-002",
    input: query.slice(0, 8000),
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;

  const { data, error } = await supabase.rpc("search_semantic_memories", {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
    filter_type: type || null,
  });

  if (error) {
    throw new Error(`Failed to search semantic memories: ${error.message}`);
  }

  return data || [];
}

export async function decaySemanticMemories() {
  const supabase = await createClient();

  const { error } = await supabase.rpc("decay_semantic_memories");

  if (error) {
    throw new Error(`Failed to decay semantic memories: ${error.message}`);
  }
}

export async function findRelatedSemanticMemories(
  semanticMemoryId: string,
  threshold: number = 0.7
) {
  const supabase = await createClient();

  // First get the memory and its embedding
  const { data: memory, error: fetchError } = await supabase
    .from("semantic_memories")
    .select("embedding")
    .eq("id", semanticMemoryId)
    .single();

  if (fetchError || !memory?.embedding) {
    throw new Error("Failed to fetch semantic memory");
  }

  // Search for related memories
  const { data, error } = await supabase.rpc("search_semantic_memories", {
    query_embedding: memory.embedding,
    match_threshold: threshold,
    match_count: 5,
  });

  if (error) {
    throw new Error(`Failed to find related memories: ${error.message}`);
  }

  // Filter out the original memory
  return (data || []).filter((m: { id: string }) => m.id !== semanticMemoryId);
}
