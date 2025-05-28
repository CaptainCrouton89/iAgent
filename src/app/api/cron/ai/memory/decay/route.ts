import { createAdminClient } from "@/utils/supabase/service";
import { NextResponse } from "next/server";

// Maximum duration for this API route (30 seconds)
export const maxDuration = 30;

// Base decay rate per day for each label type
// Adjusted for typical starting strength of 0.5-0.7
const BASE_DECAY_RATES: Record<string, number> = {
  important: 0.001,      // -0.1% per day (never deleted)
  user_profile: 0.001,   // -0.1% per day (~400-600 days from 0.5-0.7)
  general: 0.003,        // -0.3% per day (~133-200 days from 0.5-0.7)
  temporary: 0.01,       // -1% per day (~40-60 days from 0.5-0.7)
  trivial: 0.02,         // -2% per day (~20-30 days from 0.5-0.7)
};

export async function GET(request: Request) {
  // Verify this is a legitimate cron job request with proper authorization
  const authHeader = request.headers.get("authorization");
  if (
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    process.env.CRON_SECRET
  ) {
    console.error("Unauthorized cron job attempt");
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  try {
    // Initialize Supabase client with service role for admin access
    const supabase = createAdminClient();

    // Get all non-pinned memories
    const { data: memories, error: fetchError } = await supabase
      .from("memories")
      .select("id, label, strength, last_used, auth_id")
      .eq("pinned", false)
      .gt("strength", 0); // Only process memories with positive strength

    if (fetchError) {
      console.error("Error fetching memories:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch memories" },
        { status: 500 }
      );
    }

    console.log(`Processing ${memories?.length || 0} memories for decay`);

    // Track results
    const results = {
      total: memories?.length || 0,
      processed: 0,
      decayed: 0,
      deleted: 0,
      errors: 0,
    };

    const now = new Date();
    const memoriesToDelete: string[] = [];
    const memoriesToUpdate: Array<{
      id: string;
      newStrength: number;
    }> = [];

    // Process each memory
    if (memories && memories.length > 0) {
      for (const memory of memories) {
        results.processed++;

        try {
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
            results.deleted++;
          } else if (newStrength < memory.strength) {
            memoriesToUpdate.push({ id: memory.id, newStrength });
            results.decayed++;
          }
        } catch (error) {
          console.error(`Error processing memory ${memory.id}:`, error);
          results.errors++;
        }
      }
    }

    // Batch update memories
    if (memoriesToUpdate.length > 0) {
      // Update in batches of 100 to avoid query size limits
      const batchSize = 100;
      for (let i = 0; i < memoriesToUpdate.length; i += batchSize) {
        const batch = memoriesToUpdate.slice(i, i + batchSize);
        
        // Update each memory individually (Supabase doesn't support bulk updates with different values)
        const updatePromises = batch.map(({ id, newStrength }) =>
          supabase
            .from("memories")
            .update({ strength: newStrength })
            .eq("id", id)
        );

        const updateResults = await Promise.allSettled(updatePromises);
        
        // Count errors
        updateResults.forEach((result) => {
          if (result.status === "rejected") {
            console.error("Error updating memory:", result.reason);
            results.errors++;
            results.decayed--; // Correct the count
          }
        });
      }
    }

    // Batch delete memories
    if (memoriesToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("memories")
        .delete()
        .in("id", memoriesToDelete);

      if (deleteError) {
        console.error("Error deleting memories:", deleteError);
        results.errors += memoriesToDelete.length;
        results.deleted = 0; // Reset count on error
      } else {
        console.log(`Deleted ${memoriesToDelete.length} low-strength memories`);
      }
    }

    // Log summary
    console.log("Memory decay cron job completed:", results);

    return NextResponse.json({
      success: true,
      message: "Memory decay processing complete",
      results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Error in memory decay cron job:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}