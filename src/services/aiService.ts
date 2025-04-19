import { openai } from "@ai-sdk/openai";
import { generateText, streamText, type Message } from "ai";
import { getSystemPrompt } from "../prompts/email.prompt";
import { PerplexityClient } from "../tools/perplexity";

interface AIServiceOptions {
  debug?: boolean;
  perplexityApiKey?: string;
}

interface EmailData {
  from: string;
  subject: string;
  body: string;
  recipient?: string;
  history?: Message[];
}

export class AIService {
  private debug: boolean;
  private perplexityClient: PerplexityClient;

  constructor(options: AIServiceOptions = {}) {
    this.debug = options.debug || false;
    this.perplexityClient = new PerplexityClient({
      apiKey: options.perplexityApiKey,
    });
  }

  /**
   * Generate an email response using GPT-4.1
   * Has access to web search capabilities through Perplexity API
   */
  async generateEmailResponse(emailData: EmailData) {
    const systemPrompt = getSystemPrompt();

    if (this.debug) {
      console.log("System prompt:", systemPrompt);
      console.log("Email data:", emailData);
    }

    try {
      const response = await generateText({
        model: openai("gpt-4.1-2025-04-14"),
        system: systemPrompt,
        prompt: `
          Email From: ${emailData.from}
          Subject: ${emailData.subject}
          
          ${emailData.body}
          
          Generate an engaging response. If the email mentions recent events, products, or information that you might not have up-to-date knowledge about, use the search tools to verify facts before replying.
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
