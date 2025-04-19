import { openai } from "@ai-sdk/openai";
import { generateText, type Message } from "ai";
import { getSystemPrompt } from "../prompts/emailPrompt";

interface AIServiceOptions {
  debug?: boolean;
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

  constructor(options: AIServiceOptions = {}) {
    this.debug = options.debug || false;
  }

  /**
   * Generate an email response using GPT-4.1
   */
  async generateEmailResponse(emailData: EmailData) {
    const systemPrompt = getSystemPrompt();

    if (this.debug) {
      console.log("System prompt:", systemPrompt);
      console.log("Email data:", emailData);
    }

    try {
      // The tools parameter requires a specific format in the AI SDK
      // We're directly passing the tools array to avoid type issues
      const response = await generateText({
        model: openai("gpt-4.1-2025-04-14"),
        system: systemPrompt,
        prompt: `
          Email From: ${emailData.from}
          Subject: ${emailData.subject}
          
          ${emailData.body}
          
          Generate an engaging response.
        `,
        messages: emailData.history,
      });

      return response.text;
    } catch (error) {
      console.error("Error generating AI response:", error);
      throw error;
    }
  }
}
