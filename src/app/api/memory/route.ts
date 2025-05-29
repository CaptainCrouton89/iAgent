import { saveConversation } from "@/actions/memory-chat";
import { createClient } from "@/utils/supabase/server"; // Server-side client
import { openai } from "@ai-sdk/openai";
import { Message } from "@ai-sdk/react";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

// Zod schema for the preliminary lesson check
const preliminaryLessonCheckSchema = z.object({
  lesson_exists: z
    .boolean()
    .describe("Indicates if there is definitely a new lesson for the AI."),
});

// Zod schema for extracting interaction lessons - SIMPLIFIED
const lessonSchema = z.object({
  lessons_description: z
    .string()
    .optional() // Optional: AI might return nothing if no new lesson after all
    .describe("A concise, actionable piece of advice for future interactions"),
});

const PRELIMINARY_LESSON_CHECK_SYSTEM_PROMPT = `You are an AI interaction analyst. You will be provided with a list of existing interaction lessons for a user and a new conversation with that same user.
Your ONLY task is to determine if there is ANY potential NEW, non-duplicate lesson that a conversational AI could learn from the LATEST conversation to improve its future interactions with the user.
A lesson should be a concise, actionable instruction for the AI about *how* to interact (e.g., its tone, phrasing, or communication style), not about *what* topics to discuss or abstract psychological goals.

Examples of lessons (focus on interaction style/behavior):
- "When the user seems rushed, you should provide more concise answers."
- "You might want to acknowledge past points more explicitly, as the user responds well to this."
- "Maintain a respectful, neutral tone; avoid pity or patronizing language."
- "Deliver natural, flowing commentary without questions to foster idea-driven conversations."

Examples of lessons that are NOT valid (avoid these types):
- "Help the user explore and accept the emotional complexity of difficult moral dilemmas, emphasizing that feeling conflicted is normal and that patience in decision-making can be a form of strength." (This is about content/goals, not interaction style)
- "If the user mentions [topic X], try to recall their previous sentiment about it, as this is important to them." (This is more about memory/content recall than a direct interaction style adjustment)

If no new, distinct lesson focusing on interaction style is found, this may be empty or not present.

Do not extract the lesson itself. Just answer true or false whether a *new stylistic/behavioral* lesson exists.

Consider:
- Explicit or implicit user preferences in the new conversation.
- Moments of positive engagement or frustration/confusion in the new conversation.
- Any patterns in user behavior or communication style in the new conversation.
- CRITICALLY: Ensure the potential lesson is genuinely new and not a rephrasing of an existing lesson provided.

If some greater truth about how to interact with the user is revealed in the new conversation, respond true. Otherwise, respond false.

The answer should usually be no.`;

const LESSON_EXTRACTION_SYSTEM_PROMPT = `You are an AI interaction analyst. You have been provided with a list of existing interaction lessons for this user, and a new conversation. A preliminary check indicated a potential new lesson in this conversation.
Your task is to carefully review the LATEST conversation and extract THE SPECIFIC actionable lesson.
The lesson you extract must be distinct and not a duplicate or slight rephrasing of any of the EXISTING lessons provided in the prompt.

Focus on:
- User's explicit or implicit communication preferences (e.g., tone, directness, level of detail) from the LATEST conversation.
- Topics or styles that led to positive engagement or, conversely, frustration/confusion in the LATEST conversation.
- Key takeaways about what this user values in conversation (e.g., being remembered, efficiency, empathy, humor) based on the LATEST conversation.

The output should be ONLY the lesson description string itself. It should be a **very concise, direct, and actionable instruction for the AI, phrased in the second person and starting with a verb (imperative mood).**
For example:
- "Offer more concrete examples when explaining complex topics to this user."
- "Try a more empathetic tone when the user expresses frustration."
- "Avoid pitying or patronizing the user; maintain respectful, neutral tone."

If, after careful review, no genuinely distinct and actionable lesson (compared to the existing ones) can be formulated from the LATEST conversation, return an empty string or a very short phrase indicating no new lesson (e.g., "No new lesson found.").
CRITICALLY: Do NOT return any of the existing lessons provided. Only return a genuinely new insight, or indicate none was found.`;

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

    // After saving, boost strength of memories that were relevant to this conversation
    let relevanceAnalysisError: string | null = null;
    let relevantMemoriesCount = 0;

    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Get recent memories to analyze for relevance
        const { data: recentMemories, error: fetchError } = await supabase
          .from("memories")
          .select("id, title, summary, strength")
          .eq("auth_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20); // Analyze last 20 memories

        if (!fetchError && recentMemories && recentMemories.length > 0) {
          // Create conversation text for analysis
          const conversationText = messages
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n");

          // Use AI to identify which memories are relevant to this conversation
          const relevanceSchema = z.object({
            relevant_memory_ids: z
              .array(z.string())
              .describe("IDs of memories that are relevant to the current conversation"),
          });

          const memoriesContext = recentMemories
            .map((m) => `ID: ${m.id}\nTitle: ${m.title}\nSummary: ${m.summary}`)
            .join("\n\n");

          const { object: relevanceData } = await generateObject({
            model: openai("gpt-4.1-nano"),
            schema: relevanceSchema,
            prompt: `Analyze this conversation and identify which previous memories are relevant:

CONVERSATION:
${conversationText}

PREVIOUS MEMORIES:
${memoriesContext}

Return the IDs of memories that are topically relevant, share themes, or provide useful context for this conversation.`,
            system: `You are analyzing a conversation to identify relevant previous memories. A memory is relevant if:
- It shares similar topics or themes
- It provides useful context for understanding the conversation
- It contains information that relates to what was discussed
- It shows patterns or connections to the current discussion

Only return IDs of memories that have clear relevance. Be selective - not every memory needs to be relevant.`,
            temperature: 0.1,
          });

          // Boost strength of relevant memories
          if (relevanceData.relevant_memory_ids.length > 0) {
            const updatePromises = relevanceData.relevant_memory_ids.map(
              async (memoryId) => {
                // Get current strength
                const { data: memory } = await supabase
                  .from("memories")
                  .select("strength")
                  .eq("id", memoryId)
                  .eq("auth_id", user.id)
                  .single();

                if (memory) {
                  // Boost strength by 0.05 (smaller than direct usage boost)
                  const newStrength = Math.min(1.0, (memory.strength || 0.5) + 0.05);
                  return supabase
                    .from("memories")
                    .update({
                      strength: newStrength,
                      last_used: new Date().toISOString(),
                    })
                    .eq("id", memoryId)
                    .eq("auth_id", user.id);
                }
              }
            );

            await Promise.all(updatePromises);
            relevantMemoriesCount = relevanceData.relevant_memory_ids.length;
          }
        }
      }
    } catch (error) {
      console.error("Error in relevance analysis:", error);
      relevanceAnalysisError = error instanceof Error ? error.message : "Unknown error";
    }

    let lessonExtractionError: string | null = null;
    let lessonSaved = false;
    let preliminaryCheckSkippedDetailedExtraction = false;

    const supabase = await createClient(); // Create client once
    let auth_id: string | null = null;
    let existingLessons: string[] = [];
    let currentSettingsId: string | number | null = null; // Supabase ID can be number or string (UUID)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(
        "Error fetching user for lesson context/saving:",
        userError
      );
      lessonExtractionError =
        "Failed to authenticate user for lesson processing.";
      // If no user, we can't proceed with lesson logic that requires user context
    } else {
      auth_id = user.id;
      // Fetch current settings for this auth_id to get existing lessons
      const { data: currentSettingsData, error: fetchError } = await supabase
        .from("assistant_settings")
        .select("id, interaction_lessons")
        .eq("auth_id", auth_id)
        .maybeSingle();

      if (fetchError) {
        console.error(
          "Error fetching current assistant_settings for lesson context:",
          fetchError
        );
        lessonExtractionError =
          "Failed to fetch existing lessons; proceeding without them.";
        // existingLessons remains empty
      } else if (currentSettingsData) {
        currentSettingsId = currentSettingsData.id;
        const settingsLessons = currentSettingsData.interaction_lessons;
        if (
          Array.isArray(settingsLessons) &&
          settingsLessons.every((lesson) => typeof lesson === "string")
        ) {
          existingLessons = settingsLessons as string[];
        } else if (settingsLessons) {
          console.warn(
            `Existing interaction lessons for auth_id ${auth_id} (fetched early) are not a valid string array. Data:`,
            settingsLessons
          );
          // existingLessons remains empty
        }
      }
    }

    // Only proceed with lesson extraction if we have a user
    if (auth_id) {
      try {
        const preliminaryPrompt = `Previously learned lessons for this user (avoid suggesting duplicates or very similar lessons):
${
  existingLessons.length > 0
    ? existingLessons.map((l) => `- ${l}`).join("\n")
    : "None"
}

Analyze ONLY the following NEW conversation to determine if ANY new, non-duplicate lesson can be learned:
${messages.map((m) => `${m.role}: ${m.content}`).join("\n")}`;

        const { object: preliminaryData } = await generateObject({
          model: openai("gpt-4.1-nano"),
          schema: preliminaryLessonCheckSchema,
          prompt: preliminaryPrompt,
          system: PRELIMINARY_LESSON_CHECK_SYSTEM_PROMPT,
          temperature: 0.1,
        });

        console.log("Preliminary lesson check data:", preliminaryData);

        if (preliminaryData.lesson_exists) {
          const detailedPrompt = `Previously learned lessons for this user (ensure your new lesson is distinct and not a repeat):
${
  existingLessons.length > 0
    ? existingLessons.map((l) => `- ${l}`).join("\n")
    : "None"
}

Analyze ONLY the following NEW conversation and extract a NEW, non-duplicate interaction lesson string. If no new lesson, return an empty string or a short phrase like "No new lesson.":
${messages.map((m) => `${m.role}: ${m.content}`).join("\n")}`;

          const { object: lessonData } = await generateObject({
            model: openai("gpt-4.1"),
            schema: lessonSchema,
            prompt: detailedPrompt,
            system: LESSON_EXTRACTION_SYSTEM_PROMPT,
            temperature: 0.2,
          });

          console.log("Extracted lesson data (simplified):", lessonData);

          const newLessonDescription = lessonData.lessons_description?.trim();

          // Check if a meaningful, new lesson description was returned
          if (
            newLessonDescription &&
            newLessonDescription !== "" &&
            !["no new lesson", "no lesson"].includes(
              newLessonDescription.toLowerCase()
            )
          ) {
            // Check for simple duplication locally as a safeguard

            const updatedLessons = [...existingLessons, newLessonDescription];

            if (currentSettingsId) {
              // Update existing row
              const { error: updateError } = await supabase
                .from("assistant_settings")
                .update({ interaction_lessons: updatedLessons })
                .eq("id", currentSettingsId);
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
              // Insert new row
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
          } else {
            console.log(
              "No new, actionable lesson was extracted or it was a non-lesson phrase."
            );
            // lessonExtractionError can be set here if desired, e.g., "No new lesson found by AI."
          }
        } else {
          console.log(
            "Preliminary check indicated no potential new lesson. Skipping detailed extraction."
          );
          preliminaryCheckSkippedDetailedExtraction = true;
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
    } else if (!lessonExtractionError) {
      // If auth_id was null and no prior error was set
      lessonExtractionError =
        "User not authenticated, skipping lesson processing.";
      console.log("User not authenticated, skipping lesson processing.");
    }

    return NextResponse.json({
      success: true,
      conversationSaveStatus: "Saved successfully.",
      relevanceAnalysis: {
        processed: true,
        relevantMemoriesCount,
        error: relevanceAnalysisError,
      },
      lessonExtraction: {
        processed: true,
        lessonSaved,
        skippedDetailedExtraction: preliminaryCheckSkippedDetailedExtraction,
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
