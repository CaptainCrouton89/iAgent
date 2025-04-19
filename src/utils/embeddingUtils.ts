import OpenAI from "openai";

/**
 * Utility class for generating text embeddings
 */
export class EmbeddingUtils {
  private static openaiClient: OpenAI | null = null;

  /**
   * Initialize the OpenAI client (call this once during app startup)
   */
  static initializeOpenAI(apiKey: string): void {
    this.openaiClient = new OpenAI({ apiKey });
  }

  /**
   * Generate an embedding for a text string using OpenAI's API
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openaiClient) {
      throw new Error(
        "OpenAI client not initialized. Call initializeOpenAI first."
      );
    }

    try {
      const response = await this.openaiClient.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  static async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.openaiClient) {
      throw new Error(
        "OpenAI client not initialized. Call initializeOpenAI first."
      );
    }

    try {
      const response = await this.openaiClient.embeddings.create({
        model: "text-embedding-3-small",
        input: texts,
      });

      return response.data.map(
        (item: { embedding: number[] }) => item.embedding
      );
    } catch (error) {
      console.error("Error generating embeddings:", error);
      throw error;
    }
  }
}
