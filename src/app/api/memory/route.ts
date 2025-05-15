import { saveConversation } from "@/actions/memory-chat";
import { createClient } from "@/utils/supabase/server"; // Server-side client
import { openai } from "@ai-sdk/openai";
import { Message } from "@ai-sdk/react";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

// Zod schema for extracting interaction lessons
const lessonSchema = z.object({
  lessons_learned: z
    .boolean()
    .describe(
      "Indicates if any specific lessons on how to better interact with the user were learned from this conversation."
    ),
  lessons_description: z
    .string()
    .optional()
    .describe(
      "A concise, actionable piece of advice for the main conversational agent, phrased in the second person (addressing the agent). Examples: 'When the user seems rushed, you should provide more concise answers.', 'You might want to acknowledge past points more explicitly, as the user responds well to this.', 'If the user mentions [topic X], try to recall their previous sentiment about it, as this is important to them.'"
    ),
  importance_score: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      "A score from 0.0 to 1.0 indicating how crucial this lesson is for the main agent to incorporate. Only present if lessons_learned is true."
    ),
});

const LESSON_EXTRACTION_SYSTEM_PROMPT = `You are an AI interaction analyst. Your task is to review the provided conversation and extract a key actionable lesson that a conversational AI (the user's conversational partner) can use to improve its future interactions with THIS SPECIFIC USER. 

Focus on: 
- User's explicit or implicit communication preferences (e.g., tone, directness, level of detail).
- Topics or styles that led to positive engagement or, conversely, frustration/confusion.
- Key takeaways about what this user values in conversation (e.g., being remembered, efficiency, empathy, humor).

The output 'lessons_description' should be a **very concise, direct, and actionable instruction for the AI, phrased in the second person and starting with a verb (imperative mood).**
For example:
- "Offer more concrete examples when explaining complex topics to this user."
- "Try a more empathetic tone when the user expresses frustration."
- "Avoid pitying or patronizing the user; maintain respectful, neutral tone."

Output ONLY whether a lesson was learned, the lesson description (following the specified format), and its importance score.
- If no specific, actionable lesson is identified that would significantly improve future interactions, set lessons_learned to false.
- If a lesson is identified, describe it as an actionable insight for an AI and provide an importance score. Higher scores for lessons that are critical for maintaining good rapport or achieving the user's conversational goals.`;

export async function POST(req: Request) {
  try {
    const { messages }: { messages: Message[] } = await req.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid request: messages must be an array" },
        { status: 400 }
      );
    }

    const saveConversationResult = await saveConversation(messages);

    if (!saveConversationResult.success) {
      return NextResponse.json(
        {
          error: saveConversationResult.error || "Failed to save conversation",
        },
        { status: 500 }
      );
    }

    // After successfully saving the conversation, attempt to extract interaction lessons
    let lessonExtractionError: string | null = null;
    let lessonSaved = false;

    try {
      const { object: lessonData } = await generateObject({
        model: openai("gpt-4.1-nano"),
        schema: lessonSchema,
        prompt: `Analyze the following conversation and extract interaction lessons based on the user's behavior and preferences: ${messages
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n")}`,
        system: LESSON_EXTRACTION_SYSTEM_PROMPT,
        temperature: 0.2, // Low temperature for more deterministic lesson extraction
      });

      console.log("Extracted lesson data:", lessonData);

      if (
        lessonData.lessons_learned &&
        lessonData.lessons_description &&
        lessonData.importance_score &&
        lessonData.importance_score > 0.5
      ) {
        const supabase = await createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          console.error("Error fetching user for lesson saving:", userError);
          lessonExtractionError =
            "Failed to authenticate user for saving lesson.";
        } else {
          const auth_id = user.id;
          const newLessonDescription = lessonData.lessons_description;

          // Fetch current settings for this auth_id
          const { data: currentSettings, error: fetchError } = await supabase
            .from("assistant_settings")
            .select("id, interaction_lessons")
            .eq("auth_id", auth_id)
            .single(); // Expecting zero or one row

          if (fetchError && fetchError.code !== "PGRST116") {
            // PGRST116: Row not found, which is fine
            console.error(
              "Error fetching current assistant_settings:",
              fetchError
            );
            lessonExtractionError =
              "Failed to fetch current interaction lessons.";
          } else {
            let existingLessons: string[] = [];
            const settingsData = currentSettings?.interaction_lessons;

            if (
              Array.isArray(settingsData) &&
              settingsData.every((lesson) => typeof lesson === "string")
            ) {
              existingLessons = settingsData as string[];
            } else if (settingsData) {
              // It exists but is not a clean string array
              console.warn(
                `Existing interaction lessons for auth_id ${auth_id} are not a valid string array. New lesson will be added to an empty list for this update if saving a new row, or overwrite if updating existing. Data:`,
                settingsData
              );
              // existingLessons remains [], so effectively starting fresh for this update if the stored data is messy
            }
            // If settingsData is null/undefined, existingLessons also remains []

            const updatedLessons = [...existingLessons, newLessonDescription];

            // Check if a row was found or if it's an insert case
            const settingsExist = !fetchError && currentSettings;

            if (settingsExist) {
              // Update existing row
              const { error: updateError } = await supabase
                .from("assistant_settings")
                .update({ interaction_lessons: updatedLessons })
                .eq("auth_id", auth_id);
              if (updateError) {
                console.error(
                  "Error updating assistant_settings:",
                  updateError
                );
                lessonExtractionError =
                  "Failed to save interaction lesson (update).";
              } else {
                console.log(
                  "Interaction lesson updated for auth_id:",
                  auth_id,
                  newLessonDescription
                );
                lessonSaved = true;
              }
            } else {
              // Insert new row (this uses updatedLessons which would be [newLessonDescription] if existing was invalid/empty)
              const { error: insertError } = await supabase
                .from("assistant_settings")
                .insert({
                  auth_id: auth_id,
                  interaction_lessons: updatedLessons,
                });
              if (insertError) {
                console.error(
                  "Error inserting new assistant_settings:",
                  insertError
                );
                lessonExtractionError =
                  "Failed to save interaction lesson (insert).";
              } else {
                console.log(
                  "Interaction lesson inserted for auth_id:",
                  auth_id,
                  newLessonDescription
                );
                lessonSaved = true;
              }
            }
          }
        }
      }
    } catch (e: unknown) {
      console.error("Error during lesson extraction or saving:", e);
      if (e instanceof Error) {
        lessonExtractionError = e.message;
      } else if (typeof e === "string") {
        lessonExtractionError = e;
      } else {
        lessonExtractionError =
          "An unexpected error occurred during lesson processing.";
      }
    }

    return NextResponse.json({
      success: true,
      conversationSaveStatus: "Saved successfully.",
      lessonExtraction: {
        processed: true,
        lessonSaved,
        error: lessonExtractionError,
      },
    });
  } catch (error) {
    console.error("Error in memory POST route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
