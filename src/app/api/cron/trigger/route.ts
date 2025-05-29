import {
  decaySemanticMemories,
  extractSemanticMemories,
} from "@/actions/semantic-memory";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/service";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

// Zod schema for optimizing interaction lessons
const optimizedLessonsSchema = z.object({
  optimized_lessons: z
    .array(z.string())
    .describe(
      "An array of concise, optimized interaction lessons that consolidate the original lessons."
    ),
  themes: z
    .array(z.string())
    .describe(
      "Key themes or patterns identified across all the interaction lessons."
    ),
});

// System prompt for optimization
const LESSON_OPTIMIZATION_SYSTEM_PROMPT = `You are an AI interaction analyst specializing in optimizing user interaction lessons. Your task is to analyze a list of interaction lessons and create a more condensed, optimized list that:

1. Removes redundancy by combining similar lessons
2. Improves clarity and actionability
3. Identifies key themes or patterns across all lessons
4. Prioritizes the most important insights
5. Maintains the second-person perspective (addressing the AI directly)

The output 'optimized_lessons' should be an array of clear, concise directives that capture the essence of the original lessons. Each optimized lesson should be actionable, specific, and concise.

The output 'themes' should identify recurring patterns or categories across the lessons, helping to organize and understand the user's preferences and interaction style.`;

// Direct implementations of cron job logic
async function executeMemoryRefresh() {
  const supabase = createAdminClient();

  // Get all assistant_settings records
  const { data: allSettings, error: fetchError } = await supabase
    .from("assistant_settings")
    .select("id, auth_id, interaction_lessons");

  if (fetchError) {
    throw new Error(
      `Failed to fetch assistant settings: ${fetchError.message}`
    );
  }

  const results = {
    total: allSettings?.length || 0,
    processed: 0,
    optimized: 0,
    errors: 0,
  };

  // Process each user's settings
  if (allSettings && allSettings.length > 0) {
    for (const setting of allSettings) {
      results.processed++;

      try {
        // Skip if no lessons or invalid lessons format
        if (
          !setting.interaction_lessons ||
          !Array.isArray(setting.interaction_lessons) ||
          setting.interaction_lessons.length < 3
        ) {
          continue;
        }

        const lessons = setting.interaction_lessons as string[];

        // Skip if lessons are not strings
        if (!lessons.every((lesson) => typeof lesson === "string")) {
          console.warn(`Invalid lesson format for auth_id ${setting.auth_id}`);
          continue;
        }

        // Use generateObject to optimize the lessons
        const { object: optimizedData } = await generateObject({
          model: openai("gpt-4.1-mini"),
          schema: optimizedLessonsSchema,
          prompt: `Analyze and optimize the following interaction lessons:\n${lessons
            .map((lesson) => `- ${lesson}`)
            .join("\n")}`,
          system: LESSON_OPTIMIZATION_SYSTEM_PROMPT,
          temperature: 0.2,
        });

        // Update the database with optimized lessons
        const { error: updateError } = await supabase
          .from("assistant_settings")
          .update({
            interaction_lessons: optimizedData.optimized_lessons,
          })
          .eq("id", setting.id);

        if (updateError) {
          results.errors++;
        } else {
          results.optimized++;
        }
      } catch (error) {
        console.error(`Error processing auth_id ${setting.auth_id}:`, error);
        results.errors++;
      }
    }
  }

  return {
    success: true,
    message: "Interaction lessons optimization complete",
    results,
  };
}

async function executeMemoryDecay() {
  const supabase = createAdminClient();

  // Base decay rates per day for each label type
  const BASE_DECAY_RATES: Record<string, number> = {
    important: 0.001,      // -0.1% per day (never deleted)
    user_profile: 0.001,   // -0.1% per day
    general: 0.003,        // -0.3% per day
    temporary: 0.01,       // -1% per day
    trivial: 0.02,         // -2% per day
  };

  // Get all non-pinned memories
  const { data: memories, error: fetchError } = await supabase
    .from("memories")
    .select("id, label, strength, last_used")
    .eq("pinned", false)
    .gt("strength", 0);

  if (fetchError) {
    throw new Error(`Failed to fetch memories: ${fetchError.message}`);
  }

  const now = new Date();
  const memoriesToDelete: string[] = [];
  const memoriesToUpdate: Array<{ id: string; newStrength: number }> = [];
  let processed = 0;
  let decayed = 0;
  let deleted = 0;

  // Process each memory
  if (memories && memories.length > 0) {
    for (const memory of memories) {
      processed++;
      
      // Calculate days since last used
      const lastUsedDate = new Date(memory.last_used);
      const daysSinceLastUsed = Math.max(
        0,
        (now.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Get decay rate for this label
      const decayRate = BASE_DECAY_RATES[memory.label || "general"] || 
                       BASE_DECAY_RATES.general;

      // Calculate new strength
      const decayAmount = decayRate * daysSinceLastUsed;
      const newStrength = Math.max(0, memory.strength - decayAmount);

      // Check deletion criteria
      if (memory.label !== "important" && newStrength < 0.1) {
        memoriesToDelete.push(memory.id);
        deleted++;
      } else if (newStrength < memory.strength) {
        memoriesToUpdate.push({ id: memory.id, newStrength });
        decayed++;
      }
    }
  }

  // Update memories
  if (memoriesToUpdate.length > 0) {
    const updatePromises = memoriesToUpdate.map(({ id, newStrength }) =>
      supabase
        .from("memories")
        .update({ strength: newStrength })
        .eq("id", id)
    );
    await Promise.all(updatePromises);
  }

  // Delete memories
  if (memoriesToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("memories")
      .delete()
      .in("id", memoriesToDelete);

    if (deleteError) {
      throw new Error(`Failed to delete memories: ${deleteError.message}`);
    }
  }

  // Also decay semantic memories
  await decaySemanticMemories();

  return {
    success: true,
    message: "Memory decay completed successfully",
    results: {
      total: memories?.length || 0,
      processed,
      decayed,
      deleted,
    },
  };
}

async function executeSemanticExtraction() {
  const supabase = await createClient();

  // First, decay old semantic memories
  await decaySemanticMemories();

  // Get all users who have memories
  const { data: users, error: usersError } = await supabase
    .from("memories")
    .select("auth_id")
    .gte(
      "created_at",
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    ) // Last 7 days
    .order("created_at", { ascending: false });

  if (usersError) {
    throw new Error(`Failed to fetch users: ${usersError.message}`);
  }

  const uniqueUserIds = [...new Set(users?.map((u) => u.auth_id) || [])];
  const results = [];

  for (const userId of uniqueUserIds) {
    try {
      // Get recent episodic memories for this user
      const { data: recentMemories, error: memoriesError } = await supabase
        .from("memories")
        .select("id, created_at")
        .eq("auth_id", userId)
        .gte(
          "created_at",
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        ) // Last 24 hours
        .order("created_at", { ascending: false })
        .limit(20);

      if (memoriesError || !recentMemories?.length) {
        continue;
      }

      // Extract semantic memories from the recent episodic memories
      const extractedMemories = await extractSemanticMemories(
        recentMemories.map((m) => m.id),
        userId
      );

      results.push({
        userId,
        processedCount: recentMemories.length,
        extractedCount: extractedMemories.length,
      });
    } catch (error) {
      console.error(`Error processing user ${userId}:`, error);
    }
  }

  return {
    success: true,
    message: "Semantic memory extraction completed",
    results,
    timestamp: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    // Check authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path } = await request.json();

    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    // Map of allowed cron job paths to their handlers
    const cronHandlers: Record<
      string,
      () => Promise<{
        success: boolean;
        message: string;
        results?: unknown;
        timestamp?: string;
      }>
    > = {
      "/api/cron/ai/memory": executeMemoryRefresh,
      "/api/cron/ai/memory/decay": executeMemoryDecay,
      "/api/cron/ai/semantic-extraction": executeSemanticExtraction,
    };

    if (!cronHandlers[path]) {
      return NextResponse.json(
        { error: "Invalid cron job path" },
        { status: 400 }
      );
    }

    try {
      // Execute the cron job
      const result = await cronHandlers[path]();

      return NextResponse.json({
        success: true,
        message: `Successfully triggered ${path}`,
        result,
      });
    } catch (error) {
      console.error("Error executing cron job:", error);
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Cron job failed",
          details: error instanceof Error ? error.stack : undefined,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error triggering cron job:", error);
    return NextResponse.json(
      { error: "Failed to trigger cron job" },
      { status: 500 }
    );
  }
}
