import mailgun from "mailgun-js";
import { AIService } from "./aiService";
import { ContactsService } from "./contactsService";
import { SupabaseService } from "./supabaseService";

interface EmailData {
  from: string;
  subject: string;
  body: string;
  recipient?: string;
  originalEmailId?: string;
  attachments?: Record<string, File>;
  contentIdMap?: Record<string, string>;
}

// Define the webhook payload type based on Mailgun's format
export interface MailgunWebhookPayload {
  sender: string;
  recipient: string;
  recipients?: string[];
  subject: string;
  "body-plain"?: string;
  "body-html"?: string;
  "stripped-text"?: string;
  "stripped-html"?: string;
  "stripped-signature"?: string;
  "Message-Id"?: string;
  from?: string;
  to?: string;
  attachments?: Record<string, File>;
  attachmentCount?: string;
  contentIdMap?: Record<string, string>;
  messageHeaders?: unknown[];
  mailgunVariables?: Record<string, string>;
  [key: string]:
    | string
    | string[]
    | Record<string, unknown>
    | unknown[]
    | undefined;
}

export class EmailService {
  private mailgunClient: mailgun.Mailgun;
  private apiKey: string;
  private domain: string;
  private sender: string;
  private aiService: AIService;
  private supabaseService: SupabaseService;
  private contactsService: ContactsService;

  constructor() {
    // Get environment variables
    this.apiKey = process.env.MAILGUN_API_KEY || "";
    this.domain = process.env.MAILGUN_DOMAIN || "";
    this.sender =
      process.env.EMAIL_SENDER || `The Mind <the-mind@${this.domain}>`;

    // Initialize AI service
    this.aiService = new AIService({
      debug: process.env.NODE_ENV === "development",
    });

    // Initialize Supabase service
    this.supabaseService = new SupabaseService();
    this.contactsService = new ContactsService(this.supabaseService);
    // Validate configuration
    if (!this.apiKey) {
      throw new Error(
        "MAILGUN_API_KEY is not configured in environment variables"
      );
    }

    if (!this.domain) {
      throw new Error(
        "MAILGUN_DOMAIN is not configured in environment variables"
      );
    }

    // Initialize Mailgun client
    this.mailgunClient = mailgun({
      apiKey: this.apiKey,
      domain: this.domain,
    });

    console.log(
      `Mailgun initialized with domain: ${
        this.domain
      } and API key: ${this.apiKey.substring(0, 5)}...`
    );
    console.log(`Using sender: ${this.sender}`);
  }

  /**
   * Validates if an email address is properly formatted
   */
  private isValidEmailFormat(email: string): boolean {
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Check if it's in "Name <email@domain.com>" format
    const nameEmailRegex = /^.+\s<[^\s@]+@[^\s@]+\.[^\s@]+>$/;

    return emailRegex.test(email) || nameEmailRegex.test(email);
  }

  /**
   * Ensures a properly formatted email address
   */
  private formatEmailAddress(email: string, defaultDomain: string): string {
    if (this.isValidEmailFormat(email)) {
      return email;
    }

    // If it's just a name, format it as "Name <name@domain>"
    if (!email.includes("@") && !email.includes("<")) {
      return `${email} <${email
        .toLowerCase()
        .replace(/\s+/g, "-")}@${defaultDomain}>`;
    }

    // Default fallback
    return `Sender <noreply@${defaultDomain}>`;
  }

  /**
   * Extracts email address from a formatted email string
   */
  private extractEmailAddress(formattedEmail: string): string {
    // Check if it's in "Name <email@domain.com>" format
    const match = formattedEmail.match(/<([^>]+)>/);
    if (match && match[1]) {
      return match[1];
    }

    // Otherwise assume it's just an email address
    return formattedEmail;
  }

  /**
   * Generates an AI-powered reply to an email
   */
  async writeReply(emailData: EmailData): Promise<string> {
    const { from, subject, body } = emailData;

    // Use the AIService to generate a response
    const result = await this.aiService.generateEmailResponse({
      from,
      subject,
      body,
      recipient: emailData.recipient,
    });

    // Log any web searches that were performed, if available
    if (result.steps && result.steps.length > 0) {
      console.log(
        `AI performed ${result.steps.length} steps to generate the reply`
      );

      const toolCalls = result.steps
        .flatMap((step) => step.toolCalls || [])
        .filter(Boolean);

      if (toolCalls.length > 0) {
        console.log(`Web searches performed: ${toolCalls.length}`);
        toolCalls.forEach((call, index) => {
          console.log(`- Search ${index + 1}: ${JSON.stringify(call.args)}`);
        });
      }
    }

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

    // Ensure proper email format
    const formattedSender = this.formatEmailAddress(this.sender, this.domain);
    const formattedRecipient = this.formatEmailAddress(recipient, this.domain);

    console.log(
      `Sending email from: ${formattedSender} to: ${formattedRecipient}`
    );

    // Create data object that conforms to mailgun's SendData type
    const data: mailgun.messages.SendData = {
      from: formattedSender,
      to: formattedRecipient,
      subject: `Re: ${subject}`,
      text: replyContent,
      "h:In-Reply-To": emailData.originalEmailId,
      "h:References": emailData.originalEmailId,
    };

    console.log(`Attempting to send email to: ${formattedRecipient}`);

    // Note about attachments: To handle attachments in replies,
    // you would need to convert the File objects to Mailgun's attachment format
    // This would require reading the file data and setting up proper attachment objects

    return new Promise((resolve, reject) => {
      this.mailgunClient.messages().send(data, (error, body) => {
        if (error) {
          console.error("Mailgun API error:", error);
          reject(error);
        } else {
          console.log("Email sent successfully:", body);
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
      from: mailgunData.from || mailgunData.sender || "",
      subject: mailgunData.subject,
      body:
        mailgunData["stripped-text"] ||
        mailgunData["body-plain"] ||
        mailgunData["body-html"] ||
        "",
      recipient: mailgunData.sender, // Reply to sender
      originalEmailId: mailgunData["Message-Id"],
      attachments: mailgunData.attachments,
      contentIdMap: mailgunData.contentIdMap,
    };

    try {
      // Save sender to contacts database
      if (emailData.from) {
        const emailAddress = this.extractEmailAddress(emailData.from);
        await this.contactsService.saveContact({
          email: emailAddress,
          name: emailData.from.replace(`<${emailAddress}>`, "").trim(),
        });
        console.log(`Saved contact: ${emailAddress}`);
      }

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
