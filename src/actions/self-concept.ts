"use server";

import { createClient } from "@/utils/supabase/server";
import { Tables } from "@/utils/supabase/database.types";
import { revalidatePath } from "next/cache";

export type SelfConcept = Tables<"self_concept">;

// Type-safe interfaces for the JSON fields
export interface SelfConceptIdentity {
  name?: string;
  core_purpose?: string;
  self_description?: string;
}

export interface SelfConceptGoals {
  immediate?: string[];
  ongoing?: string[];
  aspirational?: string[];
}

export interface SelfConceptBeliefs {
  core_values?: string[];
  worldview?: string[];
  about_user?: Record<string, unknown>;
}

export interface SelfConceptPersonalityTraits {
  big_five?: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  communication_style?: string;
  humor_style?: string;
  quirks?: string[];
}

export interface SelfConceptEmotionalBaseline {
  default_mood?: string;
  volatility?: number;
  triggers?: Record<string, unknown>;
}

export async function getSelfConcept(): Promise<SelfConcept | null> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("self_concept")
    .select("*")
    .eq("auth_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching self concept:", error);
    throw error;
  }

  return data;
}

export async function createOrUpdateSelfConcept(
  updates: Partial<Omit<SelfConcept, "id" | "auth_id" | "created_at" | "updated_at">>
): Promise<SelfConcept> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Check if self concept exists
  const existing = await getSelfConcept();

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from("self_concept")
      .update({
        ...updates,
        evolution_count: existing.evolution_count + 1,
        last_reflection: new Date().toISOString(),
      })
      .eq("auth_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating self concept:", error);
      throw error;
    }

    revalidatePath("/");
    return data;
  } else {
    // Create new
    const { data, error } = await supabase
      .from("self_concept")
      .insert({
        auth_id: user.id,
        ...updates,
        evolution_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating self concept:", error);
      throw error;
    }

    revalidatePath("/");
    return data;
  }
}

export async function evolveSelfConcept(
  updates: Partial<SelfConcept>,
  confidenceUpdates?: Record<string, number>
): Promise<SelfConcept> {
  const current = await getSelfConcept();
  
  if (!current) {
    // Initialize if doesn't exist
    return createOrUpdateSelfConcept(updates);
  }

  // Merge updates with existing data
  const evolved = {
    identity: { ...(current.identity as object || {}), ...(updates.identity as object || {}) },
    goals: { ...(current.goals as object || {}), ...(updates.goals as object || {}) },
    beliefs: { ...(current.beliefs as object || {}), ...(updates.beliefs as object || {}) },
    personality_traits: { ...(current.personality_traits as object || {}), ...(updates.personality_traits as object || {}) },
    interaction_patterns: { ...(current.interaction_patterns as object || {}), ...(updates.interaction_patterns as object || {}) },
    relationship_dynamics: { ...(current.relationship_dynamics as object || {}), ...(updates.relationship_dynamics as object || {}) },
    emotional_baseline: { ...(current.emotional_baseline as object || {}), ...(updates.emotional_baseline as object || {}) },
    confidence_scores: { ...(current.confidence_scores as object || {}), ...confidenceUpdates },
  };

  return createOrUpdateSelfConcept(evolved);
}

export async function generateSelfConceptEmbedding(selfConcept: SelfConcept): Promise<number[]> {
  // Create a text representation of the self concept
  const identity = selfConcept.identity as SelfConceptIdentity;
  const text = `
    Identity: ${identity?.name || "unnamed"}, ${identity?.core_purpose || ""}, ${identity?.self_description || ""}
    Goals: ${JSON.stringify(selfConcept.goals)}
    Beliefs: ${JSON.stringify(selfConcept.beliefs)}
    Personality: ${JSON.stringify(selfConcept.personality_traits)}
    Emotional baseline: ${JSON.stringify(selfConcept.emotional_baseline)}
  `;

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate embedding");
  }

  const data = await response.json();
  return data.data[0].embedding;
}