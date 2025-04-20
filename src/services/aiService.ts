import { AgentHyveClient } from "@/tools/agent-hyve";
import { openai } from "@ai-sdk/openai";
import { generateText, streamText, type Message } from "ai";
import { getSystemPrompt } from "../prompts/email.prompt";
import { PerplexityClient } from "../tools/perplexity";
import { ContactsService } from "./contactsService";
import type { Memory } from "./memoryService";
import { MemoryService } from "./memoryService";

interface AIServiceOptions {
  debug?: boolean;
  perplexityApiKey?: string;
  agentHyveApiKey?: string;
  logLevel?: "none" | "minimal" | "detailed";
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
  emails?: string[];
}

export class AIService {
  private debug: boolean;
  private logLevel: "none" | "minimal" | "detailed";
  private perplexityClient: PerplexityClient;
  private memoryService?: MemoryService;
  private contactsService?: ContactsService;
  private agentHyveClient: AgentHyveClient;
  constructor(options: AIServiceOptions = {}) {
    this.debug = options.debug || false;
    this.logLevel = options.logLevel || (this.debug ? "detailed" : "minimal");
    this.perplexityClient = new PerplexityClient({
      apiKey: options.perplexityApiKey,
    });
    this.agentHyveClient = new AgentHyveClient({
      apiKey: options.agentHyveApiKey,
    });
    if (this.logLevel !== "none") {
      console.log(`AIService initialized with log level: ${this.logLevel}`);
    }
  }

  /**
   * Set the memory service instance
   */
  setMemoryService(memoryService: MemoryService): void {
    this.memoryService = memoryService;
    this.log("minimal", "Memory service connected to AIService");
  }

  /**
   * Set the contacts service instance
   */
  setContactsService(contactsService: ContactsService): void {
    this.contactsService = contactsService;
    this.log("minimal", "Contacts service connected to AIService");
  }

  /**
   * Internal logging method
   */
  private log(
    level: "minimal" | "detailed",
    message: string,
    data?: unknown
  ): void {
    if (this.logLevel === "none") return;
    if (level === "detailed" && this.logLevel !== "detailed") return;

    const timestamp = new Date().toISOString();
    console.log(`[AIService ${timestamp}] ${message}`);

    if (data && this.logLevel === "detailed") {
      if (typeof data === "string") {
        console.log(`[AIService Data] ${data}`);
      } else {
        console.log("[AIService Data]", JSON.stringify(data, null, 2));
      }
    }
  }

  /**
   * Extract email addresses from text using regex
   * This serves as a fallback method if the AI extraction fails
   */
  private extractEmailAddresses(text: string): string[] {
    if (!text) return [];

    // Regular expression for matching email addresses
    // This handles most common email formats including those with periods, hyphens, and plus signs
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

    // Find all matches
    const matches = text.match(emailRegex);

    // Return unique email addresses or empty array if none found
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * Generate an email response using GPT-4.1
   * Has access to web search capabilities through Perplexity API
   * Includes recent memories as context
   */
  async generateEmailResponse(emailData: EmailData) {
    this.log("minimal", `Generating email response for: ${emailData.subject}`);
    const systemPrompt = getSystemPrompt();

    // Get recent memories if memory service is available
    let recentMemories: Memory[] = [];
    if (this.memoryService) {
      try {
        this.log("minimal", "Fetching recent memories for context");
        recentMemories = await this.memoryService.getMemories({
          limit: 5,
        });

        this.log(
          "detailed",
          `Retrieved ${recentMemories.length} memories for context`
        );
        if (this.logLevel === "detailed") {
          recentMemories.forEach((memory, i) => {
            console.log(
              `Memory ${i + 1}: ${memory.content.substring(0, 100)}${
                memory.content.length > 100 ? "..." : ""
              }`
            );
          });
        }
      } catch (error) {
        console.error("Error fetching recent memories:", error);
        this.log(
          "minimal",
          "Failed to fetch memories, continuing without memory context"
        );
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

    this.log("detailed", "Preparing AI request with system prompt and context");
    if (this.logLevel === "detailed") {
      console.log("System prompt length:", systemPrompt.length);
      console.log("Email subject:", emailData.subject);
      console.log("Email from:", emailData.from);
      console.log("Email body length:", emailData.body.length);
      console.log("Memory context length:", memoriesText.length);
    }

    try {
      this.log("minimal", "Calling OpenAI for email generation");
      const startTime = Date.now();

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
          helloWorldTool: this.agentHyveClient.helloWorldTool,
        },

        maxSteps: 5, // Allow multiple steps for tool usage
      });

      const duration = Date.now() - startTime;
      this.log("minimal", `AI response generated in ${duration}ms`);

      if (response.steps) {
        this.log(
          "minimal",
          `Used ${response.steps.length} tool steps during generation`
        );

        if (this.logLevel === "detailed") {
          const toolCalls = response.steps
            .flatMap((step) => step.toolCalls || [])
            .filter(Boolean);

          if (toolCalls.length > 0) {
            this.log("detailed", `Tool usage details:`, toolCalls);
          }
        }
      }

      this.log("detailed", "Generated response length:", response.text.length);

      return {
        text: response.text,
        steps: response.steps,
      };
    } catch (error) {
      this.log("minimal", "Error generating AI response", error);
      console.error("Error generating AI response:", error);
      throw error;
    }
  }

  /**
   * Evaluate if an email is relevant enough to create a memory
   * Returns a relevance score between 0 and 1
   * Also extracts any email addresses present in the content
   */
  async evaluateMemoryRelevance(data: {
    source: string;
    content: EmailData | Record<string, unknown>;
  }): Promise<MemoryRelevanceResult> {
    this.log(
      "minimal",
      `Evaluating memory relevance for source: ${data.source}`
    );

    try {
      let prompt = "";

      if (data.source === "email") {
        const emailData = data.content as EmailData;
        this.log(
          "detailed",
          `Evaluating email from ${emailData.from} with subject ${emailData.subject}`
        );

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
          
          Additionally, identify any email addresses mentioned in the content.
          
          Return a JSON object with:
          1. A "relevance" score between 0 and 1, where:
             - 0.0-0.2: Not worth remembering at all
             - 0.3-0.4: Minimal importance
             - 0.5-0.7: Moderately important to remember
             - 0.8-1.0: Critical information that must be remembered
          2. A brief "summary" of what makes this worth remembering (if relevance > 0.3)
          3. An "emails" array containing any email addresses found in the content
          
          Format: { "relevance": 0.X, "summary": "brief summary if relevant", "emails": ["email1@example.com", "email2@example.com"] }
        `;
      } else if (data.source === "chat") {
        const content = data.content as Record<string, unknown>;
        const message = content.message || "";
        this.log(
          "detailed",
          `Evaluating chat message: ${String(message).substring(0, 100)}${
            String(message).length > 100 ? "..." : ""
          }`
        );

        prompt = `
          Content type: chat message
          Content: ${JSON.stringify(message)}
          
          Analyze this chat message and determine if it contains information that should be remembered for future interactions.
          Consider how important this information might be for future reference.
          
          Also identify any email addresses mentioned in the content.
          
          Return a JSON object with:
          1. A "relevance" score between 0 and 1
          2. A brief "summary" of what makes this worth remembering (if relevance > 0.3)
          3. An "emails" array containing any email addresses found in the content
          
          Format: { "relevance": 0.X, "summary": "brief summary if relevant", "emails": ["email1@example.com", "email2@example.com"] }
        `;
      } else {
        // Generic format for other sources
        this.log(
          "detailed",
          `Evaluating generic content from source: ${data.source}`
        );

        prompt = `
          Content type: ${data.source}
          Content: ${JSON.stringify(data.content)}
          
          Analyze this content and determine if it contains information that should be remembered for future interactions.
          Consider how important this information might be for future reference.
          
          Also identify any email addresses mentioned in the content.
          
          Return a JSON object with:
          1. A "relevance" score between 0 and 1
          2. A brief "summary" of what makes this worth remembering (if relevance > 0.3)
          3. An "emails" array containing any email addresses found in the content
          
          Format: { "relevance": 0.X, "summary": "brief summary if relevant", "emails": ["email1@example.com", "email2@example.com"] }
        `;
      }

      const startTime = Date.now();
      this.log("minimal", "Calling AI to evaluate memory relevance");

      const response = await generateText({
        model: openai("gpt-4.1-2025-04-14"),
        system:
          "You are an AI assistant that evaluates the relevance and importance of information for memory storage. You can also identify and extract email addresses from the content.",
        prompt,
      });

      const duration = Date.now() - startTime;
      this.log("minimal", `Relevance evaluation completed in ${duration}ms`);

      try {
        // Parse the JSON response
        const result = JSON.parse(response.text) as MemoryRelevanceResult;

        // Ensure the relevance is between 0 and 1
        result.relevance = Math.max(0, Math.min(1, result.relevance));

        this.log("minimal", `Memory relevance score: ${result.relevance}`);
        if (result.summary) {
          this.log("detailed", `Memory summary: ${result.summary}`);
        }

        // Save extracted emails to contacts if available
        if (this.contactsService) {
          // Use emails from AI extraction or fall back to regex extraction
          let emailsToSave: string[] = [];

          if (result.emails && result.emails.length > 0) {
            emailsToSave = result.emails;
            this.log(
              "minimal",
              `Found ${emailsToSave.length} emails from AI extraction`
            );
          } else {
            // Try to extract emails using regex as fallback
            let contentText = "";

            if (data.source === "email") {
              const emailData = data.content as EmailData;
              contentText = `${emailData.from} ${emailData.subject} ${emailData.body}`;
            } else if (data.source === "chat") {
              const content = data.content as Record<string, unknown>;
              contentText = String(content.message || "");
            } else {
              contentText = JSON.stringify(data.content);
            }

            emailsToSave = this.extractEmailAddresses(contentText);
            this.log(
              "minimal",
              `Found ${emailsToSave.length} emails from regex fallback`
            );
          }

          // Save the extracted emails
          if (emailsToSave.length > 0) {
            this.log("minimal", `Saving ${emailsToSave.length} contacts`);

            for (const email of emailsToSave) {
              try {
                await this.contactsService.saveContact({ email });
                this.log("detailed", `Saved contact: ${email}`);
              } catch (error) {
                this.log("minimal", `Error saving contact ${email}`, error);
                console.error(`Error saving contact ${email}:`, error);
              }
            }
          }
        }

        return result;
      } catch (parseError) {
        this.log(
          "minimal",
          "Error parsing memory relevance result",
          parseError
        );
        console.error("Error parsing memory relevance result:", parseError);
        // Fallback to a default value if parsing fails
        return { relevance: 0 };
      }
    } catch (error) {
      this.log("minimal", "Error evaluating memory relevance", error);
      console.error("Error evaluating memory relevance:", error);
      throw error;
    }
  }

  /**
   * Generate a response with web search capabilities using Perplexity
   */
  async generateWithWebSearch(query: string, history?: Message[]) {
    this.log(
      "minimal",
      `Generating response with web search for query: ${query.substring(
        0,
        50
      )}${query.length > 50 ? "..." : ""}`
    );

    if (history && history.length > 0) {
      this.log(
        "detailed",
        `With conversation history of ${history.length} messages`
      );
    }

    try {
      const startTime = Date.now();
      this.log("minimal", "Calling AI with web search capabilities");

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

      const duration = Date.now() - startTime;
      this.log(
        "minimal",
        `AI response with web search generated in ${duration}ms`
      );

      if (response.steps) {
        const toolCalls = response.steps
          .flatMap((step) => step.toolCalls || [])
          .filter(Boolean);

        this.log(
          "minimal",
          `Used ${toolCalls.length} web searches during generation`
        );

        if (this.logLevel === "detailed" && toolCalls.length > 0) {
          toolCalls.forEach((call, i) => {
            this.log(
              "detailed",
              `Search ${i + 1}: ${JSON.stringify(call.args)}`
            );
          });
        }
      }

      return {
        text: response.text,
        steps: response.steps,
      };
    } catch (error) {
      this.log("minimal", "Error generating response with web search", error);
      console.error("Error generating response with web search:", error);
      throw error;
    }
  }

  /**
   * Stream a response with web search capabilities using Perplexity
   */
  async streamWithWebSearch(query: string, history?: Message[]) {
    this.log(
      "minimal",
      `Streaming response with web search for query: ${query.substring(0, 50)}${
        query.length > 50 ? "..." : ""
      }`
    );

    if (history && history.length > 0) {
      this.log(
        "detailed",
        `With conversation history of ${history.length} messages`
      );
    }

    try {
      const startTime = Date.now();
      this.log("minimal", "Starting streaming response with web search");

      const stream = await streamText({
        model: openai("gpt-4.1-2025-04-14"),
        system:
          "You are a helpful assistant with access to web search capabilities. Use the search tools when you need current information or to verify facts.",
        messages: [...(history || []), { role: "user", content: query }],
        tools: {
          search: this.perplexityClient.searchTool,
          searchWithDateRange: this.perplexityClient.searchWithDateRangeTool,
        },
        maxSteps: 5, // Allow multiple steps for tool usage
      });

      const duration = Date.now() - startTime;
      this.log("minimal", `Streaming response initiated in ${duration}ms`);

      // Create a wrapped stream that logs when the stream ends
      const originalToDataStreamResponse = stream.toDataStreamResponse;
      stream.toDataStreamResponse = function () {
        const response = originalToDataStreamResponse.apply(this);
        return response;
      };

      return stream;
    } catch (error) {
      this.log("minimal", "Error streaming response with web search", error);
      console.error("Error streaming response with web search:", error);
      throw error;
    }
  }

  /**
   * Generate a chat response using the same AI model as email
   * Also has access to web search and memories
   */
  async generateChatResponse(message: string) {
    this.log(
      "minimal",
      `Generating chat response for message: ${message.substring(0, 50)}${
        message.length > 50 ? "..." : ""
      }`
    );
    const systemPrompt =
      "You are a helpful AI assistant with access to web search and memories. You respond conversationally, accurately, and helpfully to the user's questions.";

    // Get recent memories if memory service is available
    let recentMemories: Memory[] = [];
    if (this.memoryService) {
      try {
        this.log("minimal", "Fetching recent memories for chat context");
        recentMemories = await this.memoryService.getMemories({
          limit: 5,
        });

        this.log(
          "detailed",
          `Retrieved ${recentMemories.length} memories for context`
        );
        if (this.logLevel === "detailed") {
          recentMemories.forEach((memory, i) => {
            console.log(
              `Memory ${i + 1}: ${memory.content.substring(0, 100)}${
                memory.content.length > 100 ? "..." : ""
              }`
            );
          });
        }
      } catch (error) {
        console.error("Error fetching recent memories:", error);
        this.log(
          "minimal",
          "Failed to fetch memories, continuing without memory context"
        );
        // Continue without memories if there's an error
      }
    }

    // Format memories for inclusion in the chat context
    const memoriesContext = recentMemories.length
      ? `\nRecent memories that might be relevant:\n${recentMemories
          .map(
            (memory, index) =>
              `Memory ${index + 1}: ${memory.content} [Source: ${
                memory.source
              }]`
          )
          .join("\n")}`
      : "";

    this.log(
      "detailed",
      "Preparing AI chat request with system prompt and context"
    );

    try {
      const startTime = Date.now();
      this.log("minimal", "Calling OpenAI for chat response");

      // We'll use the prompt approach instead of messages to avoid compatibility issues
      let fullPrompt = message;

      // Add memory context if we have memories
      if (memoriesContext) {
        fullPrompt = `${memoriesContext}\n\n${message}`;
      }

      const response = await generateText({
        model: openai("gpt-4.1-2025-04-14"),
        system: systemPrompt,
        prompt: fullPrompt,
        tools: {
          search: this.perplexityClient.searchTool,
          searchWithDateRange: this.perplexityClient.searchWithDateRangeTool,
        },
        maxSteps: 5, // Allow multiple steps for tool usage
      });

      const duration = Date.now() - startTime;
      this.log("minimal", `AI chat response generated in ${duration}ms`);

      if (response.steps) {
        this.log(
          "minimal",
          `Used ${response.steps.length} tool steps during chat generation`
        );

        if (this.logLevel === "detailed") {
          const toolCalls = response.steps
            .flatMap((step) => step.toolCalls || [])
            .filter(Boolean);

          if (toolCalls.length > 0) {
            this.log("detailed", `Tool usage details:`, toolCalls);
          }
        }
      }

      this.log(
        "detailed",
        "Generated chat response length:",
        response.text.length
      );

      return {
        text: response.text,
        steps: response.steps,
      };
    } catch (error) {
      this.log("minimal", "Error generating AI chat response", error);
      console.error("Error generating AI chat response:", error);
      throw error;
    }
  }

  /**
   * Process raw memory content into a first-person summarized memory
   * Converts raw text into a personalized memory that captures the context and emotional tone
   */
  async processMemoryContent(data: {
    content: string;
    source: string;
  }): Promise<string> {
    this.log(
      "minimal",
      `Processing memory content from source: ${data.source}`
    );

    try {
      const response = await generateText({
        model: openai("gpt-4.1-2025-04-14"),
        system: `You are an assistant that converts raw text into meaningful first-person memories for Wendy French.
                Your task is to summarize the provided content and reframe it as a personal memory from Wendy's perspective.
                The memory should be written in first person (as Wendy), include emotional context, and capture why this memory is important to Wendy.`,
        prompt: `
          Convert the following content into a first-person memory from Wendy French's perspective that captures the essence of what happened, 
          including any emotional context and why this information is important for Wendy to remember.
          
          Source: ${data.source}
          Raw Content: ${data.content}
          
          Create a concise first-person memory (1-3 sentences) that begins with "I" (as Wendy) and captures what happened and why it matters to Wendy.
          If the content contains a conversation or interaction, include relevant details about the topic and emotional tone.
          
          Examples:
          - For an angry discussion: "I got into a heated argument with John about the project timeline. He thought we should extend by two weeks, but I disagreed because of the client commitments. I'm still frustrated about this situation."
          - For an important reminder: "I need to submit the quarterly report by Friday. Sarah emphasized this is a high priority and will affect our department's budget allocation."
          - For a personal preference: "I learned that Alex prefers written communication over calls for project updates. He mentioned having difficulty processing information in real-time conversations."
          - For an email interaction: "I emailed Susan asking for her contact information. I emphasized I wanted to share some valuable resources with her, and I'm waiting for her response with her email address."
        `,
      });

      this.log("detailed", "Processed memory:", response.text);
      return response.text.trim();
    } catch (error) {
      this.log("minimal", "Error processing memory content", error);
      console.error("Error processing memory content:", error);
      // Return the original content if processing fails
      return data.content;
    }
  }
}
