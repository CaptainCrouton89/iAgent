import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import mailgun from "mailgun-js";

interface EmailData {
  from: string;
  subject: string;
  body: string;
  recipient?: string;
  originalEmailId?: string;
}

// Define the webhook payload type based on Mailgun's format
interface MailgunWebhookPayload {
  sender: string;
  recipient: string;
  subject: string;
  "body-plain"?: string;
  "body-html"?: string;
  "Message-Id"?: string;
  [key: string]: string | undefined;
}

export class EmailService {
  private mailgunClient: mailgun.Mailgun;

  constructor() {
    // Initialize Mailgun client
    this.mailgunClient = mailgun({
      apiKey: process.env.MAILGUN_API_KEY! || "",
      domain: process.env.MAILGUN_DOMAIN! || "",
    });
  }

  /**
   * Generates an AI-powered reply to an email
   */
  async writeReply(emailData: EmailData): Promise<string> {
    const { from, subject, body } = emailData;

    // Generate AI response using the Vercel AI SDK
    const result = await generateText({
      model: openai("gpt-4.1-2025-04-14"),
      system:
        "You are a helpful assistant. Write a professional and concise email reply.",
      prompt: `
        I received this email:
        From: ${from}
        Subject: ${subject}
        
        ${body}
        
        Please write a reply that addresses the content of the email.
      `,
    });

    return result.text;
  }

  /**
   * Sends an email reply
   */
  async sendReply(
    emailData: EmailData,
    replyContent: string
  ): Promise<mailgun.messages.SendResponse> {
    const { subject, recipient } = emailData;

    if (!recipient) {
      throw new Error("No recipient provided for email reply");
    }

    const data = {
      from: process.env.EMAIL_SENDER || "The Mind <the-mind@agent-hyve.com>",
      to: recipient,
      subject: `Re: ${subject}`,
      text: replyContent,
      "h:In-Reply-To": emailData.originalEmailId,
      "h:References": emailData.originalEmailId,
    };

    return new Promise((resolve, reject) => {
      this.mailgunClient.messages().send(data, (error, body) => {
        if (error) {
          reject(error);
        } else {
          resolve(body);
        }
      });
    });
  }

  /**
   * Processes an incoming email from Mailgun webhook
   */
  async processIncomingEmail(
    mailgunData: MailgunWebhookPayload
  ): Promise<void> {
    // Extract email data from Mailgun webhook payload
    const emailData: EmailData = {
      from: mailgunData.sender,
      subject: mailgunData.subject,
      body: mailgunData["body-plain"] || mailgunData["body-html"] || "",
      recipient: mailgunData.sender, // Reply to sender
      originalEmailId: mailgunData["Message-Id"],
    };

    try {
      // Generate AI reply
      const replyContent = await this.writeReply(emailData);

      // Send the reply
      await this.sendReply(emailData, replyContent);

      console.log(`Reply sent to ${emailData.recipient}`);
    } catch (error) {
      console.error("Error processing incoming email:", error);
      throw error;
    }
  }
}
