import { openai } from "@ai-sdk/openai";
import { generateText, streamText, type Message } from "ai";
import { getSystemPrompt } from "../prompts/email.prompt";
import { PerplexityClient } from "../tools/perplexity";
import type { Memory } from "./memoryService";
import { MemoryService } from "./memoryService";

interface AIServiceOptions {
  debug?: boolean;
  perplexityApiKey?: string;
}

export interface EmailData {
  from: string;
  subject: string;
  body: string;
  recipient?: string;
  history?: Message[];
}

interface MemoryRelevanceResult {
  relevance: number;
  summary?: string;
}

export class AIService {
  private debug: boolean;
  private perplexityClient: PerplexityClient;
  private memoryService?: MemoryService;

  constructor(options: AIServiceOptions = {}) {
    this.debug = options.debug || false;
    this.perplexityClient = new PerplexityClient({
      apiKey: options.perplexityApiKey,
    });
  }

  /**
   * Set the memory service instance
   */
  setMemoryService(memoryService: MemoryService): void {
    this.memoryService = memoryService;
  }

  /**
   * Generate an email response using GPT-4.1
   * Has access to web search capabilities through Perplexity API
   * Includes recent memories as context
   */
  async generateEmailResponse(emailData: EmailData) {
    const systemPrompt = getSystemPrompt();

    // Get recent memories if memory service is available
    let recentMemories: Memory[] = [];
    if (this.memoryService) {
      try {
        recentMemories = await this.memoryService.getMemories({
          limit: 5,
        });

        if (this.debug) {
          console.log("Recent memories:", recentMemories);
        }
      } catch (error) {
        console.error("Error fetching recent memories:", error);
        // Continue without memories if there's an error
      }
    }

    // Format memories for inclusion in the prompt
    const memoriesText = recentMemories.length
      ? `
Recent memories (for context, not necessarily to be mentioned directly):
${recentMemories
  .map(
    (memory, index) =>
      `Memory ${index + 1}: ${memory.content} [Source: ${memory.source}]`
  )
  .join("\n")}
`
      : "";

    if (this.debug) {
      console.log("System prompt:", systemPrompt);
      console.log("Email data:", emailData);
      console.log("Memories text:", memoriesText);
    }

    try {
      const response = await generateText({
        model: openai("gpt-4.1-2025-04-14"),
        system: systemPrompt,
        prompt: `
          Email From: ${emailData.from}
          Subject: ${emailData.subject}
          
          ${emailData.body}
          
          ${memoriesText}
          
          Generate an engaging response. If the email mentions recent events, products, or information that you might not have up-to-date knowledge about, use the search tools to verify facts before replying. Your response should only include the response to the email, and nothing else.
        `,
        messages: emailData.history,
        tools: {
          search: this.perplexityClient.searchTool,
          searchWithDateRange: this.perplexityClient.searchWithDateRangeTool,
        },

        maxSteps: 5, // Allow multiple steps for tool usage
      });

      if (this.debug && response.steps) {
        console.log("Tool usage steps:", response.steps);
      }

      return {
        text: response.text,
        steps: response.steps,
      };
    } catch (error) {
      console.error("Error generating AI response:", error);
      throw error;
    }
  }

  /**
   * Evaluate if an email is relevant enough to create a memory
   * Returns a relevance score between 0 and 1
   */
  async evaluateMemoryRelevance(data: {
    source: string;
    content: EmailData | Record<string, unknown>;
  }): Promise<MemoryRelevanceResult> {
    try {
      let prompt = "";

      if (data.source === "email") {
        const emailData = data.content as EmailData;
        prompt = `
          Email From: ${emailData.from}
          Subject: ${emailData.subject}
          Content: ${emailData.body}
          
          Analyze this email and determine if it contains information that should be remembered for future interactions.
          Consider factors like:
          - Does it contain important personal information?
          - Does it mention upcoming events, deadlines, or important dates?
          - Does it include preferences, interests, or opinions that would be valuable to recall?
          - Does it reveal important relationship dynamics or context?
          
          Return a JSON object with:
          1. A "relevance" score between 0 and 1, where:
             - 0.0-0.2: Not worth remembering at all
             - 0.3-0.4: Minimal importance
             - 0.5-0.7: Moderately important to remember
             - 0.8-1.0: Critical information that must be remembered
          2. A brief "summary" of what makes this worth remembering (if relevance > 0.3)
          
          Format: { "relevance": 0.X, "summary": "brief summary if relevant" }
        `;
      } else {
        // Generic format for other sources
        prompt = `
          Content type: ${data.source}
          Content: ${JSON.stringify(data.content)}
          
          Analyze this content and determine if it contains information that should be remembered for future interactions.
          Consider how important this information might be for future reference.
          
          Return a JSON object with:
          1. A "relevance" score between 0 and 1
          2. A brief "summary" of what makes this worth remembering (if relevance > 0.3)
          
          Format: { "relevance": 0.X, "summary": "brief summary if relevant" }
        `;
      }

      const response = await generateText({
        model: openai("gpt-4.1-2025-04-14"),
        system:
          "You are an AI assistant that evaluates the relevance and importance of information for memory storage.",
        prompt,
      });

      try {
        // Parse the JSON response
        const result = JSON.parse(response.text) as MemoryRelevanceResult;

        // Ensure the relevance is between 0 and 1
        result.relevance = Math.max(0, Math.min(1, result.relevance));

        return result;
      } catch (parseError) {
        console.error("Error parsing memory relevance result:", parseError);
        // Fallback to a default value if parsing fails
        return { relevance: 0 };
      }
    } catch (error) {
      console.error("Error evaluating memory relevance:", error);
      throw error;
    }
  }

  /**
   * Generate a response with web search capabilities using Perplexity
   */
  async generateWithWebSearch(query: string, history?: Message[]) {
    if (this.debug) {
      console.log("Web search query:", query);
    }

    try {
      const response = await generateText({
        model: openai("gpt-4.1-2025-04-14"),
        system:
          "You are a helpful assistant with access to web search capabilities. Use the search tools when you need current information or to verify facts.",
        messages: history || [],
        prompt: query,
        tools: {
          search: this.perplexityClient.searchTool,
          searchWithDateRange: this.perplexityClient.searchWithDateRangeTool,
        },
        maxSteps: 5, // Allow multiple steps for tool usage
      });

      return {
        text: response.text,
        steps: response.steps,
      };
    } catch (error) {
      console.error("Error generating response with web search:", error);
      throw error;
    }
  }

  /**
   * Stream a response with web search capabilities using Perplexity
   */
  async streamWithWebSearch(query: string, history?: Message[]) {
    if (this.debug) {
      console.log("Web search query (streaming):", query);
    }

    try {
      const stream = await streamText({
        model: openai("gpt-4.1-2025-04-14"),
        system:
          "You are a helpful assistant with access to web search capabilities. Use the search tools when you need current information or to verify facts.",
        messages: history || [],
        prompt: query,
        tools: {
          search: this.perplexityClient.searchTool,
          searchWithDateRange: this.perplexityClient.searchWithDateRangeTool,
        },
        maxSteps: 5, // Allow multiple steps for tool usage
      });

      return stream;
    } catch (error) {
      console.error("Error streaming response with web search:", error);
      throw error;
    }
  }
}
