import { createAdminClient } from "@/utils/supabase/service";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

// Maximum duration for this API route (30 seconds)
export const maxDuration = 30;

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

    // Get all assistant_settings records
    const { data: allSettings, error: fetchError } = await supabase
      .from("assistant_settings")
      .select("id, auth_id, interaction_lessons");

    if (fetchError) {
      console.error("Error fetching assistant_settings:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch assistant settings" },
        { status: 500 }
      );
    }

    console.log(
      `Processing ${allSettings?.length || 0} assistant settings records`
    );

    // Track success and failure counts
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
            // Only optimize if we have at least 3 lessons
            continue;
          }

          const lessons = setting.interaction_lessons as string[];

          // Skip if lessons are not strings
          if (!lessons.every((lesson) => typeof lesson === "string")) {
            console.warn(
              `Invalid lesson format for auth_id ${setting.auth_id}`
            );
            continue;
          }

          console.log(
            `Optimizing ${lessons.length} lessons for auth_id ${setting.auth_id}`
          );

          // Use generateObject to optimize the lessons
          const { object: optimizedData } = await generateObject({
            model: openai("gpt-4.1-nano"),
            schema: optimizedLessonsSchema,
            prompt: `Analyze and optimize the following interaction lessons:\n${lessons
              .map((lesson) => `- ${lesson}`)
              .join("\n")}`,
            system: LESSON_OPTIMIZATION_SYSTEM_PROMPT,
            temperature: 0.2, // Low temperature for more deterministic results
          });

          console.log(optimizedData);

          // Update the database with optimized lessons
          const { error: updateError } = await supabase
            .from("assistant_settings")
            .update({
              interaction_lessons: optimizedData.optimized_lessons,
              // Could store themes in a separate field if desired
            })
            .eq("id", setting.id);

          if (updateError) {
            console.error(
              `Error updating optimized lessons for auth_id ${setting.auth_id}:`,
              updateError
            );
            results.errors++;
          } else {
            console.log(
              `Successfully optimized lessons for auth_id ${setting.auth_id}`
            );
            results.optimized++;
          }
        } catch (error) {
          console.error(`Error processing auth_id ${setting.auth_id}:`, error);
          results.errors++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Interaction lessons optimization complete",
      results,
    });
  } catch (error) {
    console.error("Error in cron job:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
