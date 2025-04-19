import { tool } from "ai";
import { z } from "zod";

// Perplexity client setup
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";

interface PerplexityOptions {
  apiKey?: string;
}

export class PerplexityClient {
  private apiKey: string;

  constructor(options: PerplexityOptions = {}) {
    this.apiKey = options.apiKey || PERPLEXITY_API_KEY || "";

    if (!this.apiKey) {
      console.warn(
        "Perplexity API key not provided. Set PERPLEXITY_API_KEY env variable or pass in constructor."
      );
    }
  }

  /**
   * Tool for searching the web with Perplexity API
   */
  searchTool = tool({
    description: "Search the web for current information using Perplexity API",
    parameters: z.object({
      query: z.string().describe("The search query to look up on the web"),
    }),
    execute: async ({ query }) => {
      try {
        const response = await fetch(
          `${PERPLEXITY_BASE_URL}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
              model: "sonar-pro",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a helpful search assistant. Provide detailed, accurate, and current information.",
                },
                {
                  role: "user",
                  content: query,
                },
              ],
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Perplexity API error: ${response.status} ${errorText}`
          );
        }

        const data = await response.json();
        return {
          result: data.choices[0]?.message?.content || "No results found",
          model: data.model,
          source: "perplexity",
        };
      } catch (error) {
        console.error("Error querying Perplexity API:", error);
        return {
          result: `Error searching the web: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          source: "perplexity_error",
        };
      }
    },
  });

  /**
   * Tool for searching the web with a date range filter
   */
  searchWithDateRangeTool = tool({
    description:
      "Search the web with a specific date range using Perplexity API",
    parameters: z.object({
      query: z.string().describe("The search query to look up on the web"),
      startDate: z.string().describe("Start date in YYYY-MM-DD format"),
      endDate: z.string().describe("End date in YYYY-MM-DD format"),
    }),
    execute: async ({ query, startDate, endDate }) => {
      try {
        const response = await fetch(
          `${PERPLEXITY_BASE_URL}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
              model: "sonar-pro",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a helpful search assistant. Provide detailed, accurate, and current information.",
                },
                {
                  role: "user",
                  content: `Search for information about "${query}" within the date range from ${startDate} to ${endDate}.`,
                },
              ],
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Perplexity API error: ${response.status} ${errorText}`
          );
        }

        const data = await response.json();
        return {
          result: data.choices[0]?.message?.content || "No results found",
          dateRange: { startDate, endDate },
          model: data.model,
          source: "perplexity",
        };
      } catch (error) {
        console.error("Error querying Perplexity API with date range:", error);
        return {
          result: `Error searching the web: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          source: "perplexity_error",
        };
      }
    },
  });
}
