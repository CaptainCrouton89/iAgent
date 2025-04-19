import type { EmailData } from "../services/aiService";
import { AIService } from "../services/aiService";
import { MemoryService } from "../services/memoryService";

/**
 * Process an email and create a memory if it's deemed relevant
 * This function should be called in parallel with the email response generation
 */
export async function processEmailForMemory(
  emailData: EmailData,
  aiService: AIService,
  memoryService: MemoryService
): Promise<void> {
  try {
    // Evaluate if the email is relevant enough for memory creation
    const relevanceResult = await aiService.evaluateMemoryRelevance({
      source: "email",
      content: emailData,
    });

    // Only create memories for emails with relevance score > 0.5
    if (relevanceResult.relevance > 0.5) {
      // Construct the memory content
      const content = relevanceResult.summary
        ? relevanceResult.summary
        : `Email from ${emailData.from} about "${
            emailData.subject
          }" was deemed relevant with score ${relevanceResult.relevance.toFixed(
            2
          )}`;

      // Create the memory
      await memoryService.createMemory({
        content,
        source: "email",
        source_id: `${emailData.from}:${emailData.subject}`,
        relevance_score: relevanceResult.relevance,
      });
    }
  } catch (error) {
    console.error("Error processing email for memory:", error);
    // Don't throw the error, as this is a parallel operation that shouldn't
    // interrupt the main email response flow
  }
}
