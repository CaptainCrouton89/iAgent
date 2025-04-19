import { EmailService, MailgunWebhookPayload } from "@/services/emailService";
import { NextResponse } from "next/server";

// Initialize the email service
const emailService = new EmailService();

export async function POST(req: Request) {
  try {
    // Verify this is a valid Mailgun webhook request
    // In production, you should validate the webhook signature using Mailgun's signing key
    const signature = req.headers.get("X-Mailgun-Signature");
    const token = req.headers.get("X-Mailgun-Token");
    const timestamp = req.headers.get("X-Mailgun-Timestamp");

    console.log("signature", signature, token, timestamp);
    // Do verification here...

    // Parse the form data from Mailgun
    const formData = await req.formData();
    console.log("formData", formData);

    // Convert FormData to a regular object, handling both string values and files
    const mailgunData: MailgunWebhookPayload = {
      sender: "",
      recipient: "",
      subject: "",
    };
    const attachments: Record<string, File> = {};
    let attachmentCount = 0;

    for (const [key, value] of formData.entries()) {
      if (key.startsWith("attachment-") && value instanceof File) {
        attachments[key] = value;
        attachmentCount++;
      } else if (typeof value === "string") {
        mailgunData[key] = value;
      } else {
        // For any other types like File that aren't attachments
        // Handle as an unknown value and cast to avoid type errors
        // This is ok since we're just passing through data from Mailgun
        (mailgunData as Record<string, unknown>)[key] = value;
      }
    }

    // Add the attachment data to mailgunData
    mailgunData.attachments = attachments;
    mailgunData.attachmentCount = attachmentCount.toString();

    // Try to parse complex JSON fields
    try {
      if (typeof mailgunData["message-headers"] === "string") {
        mailgunData.messageHeaders = JSON.parse(mailgunData["message-headers"]);
      }
      if (typeof mailgunData["X-Mailgun-Variables"] === "string") {
        mailgunData.mailgunVariables = JSON.parse(
          mailgunData["X-Mailgun-Variables"]
        );
      }
      if (typeof mailgunData["content-id-map"] === "string") {
        mailgunData.contentIdMap = JSON.parse(mailgunData["content-id-map"]);
      }
    } catch (e) {
      console.warn("Error parsing JSON fields:", e);
    }

    // Ensure required fields are present
    if (!mailgunData.sender || !mailgunData.recipient || !mailgunData.subject) {
      return NextResponse.json(
        { message: "Missing required email fields" },
        { status: 400 }
      );
    }

    // Handle multiple recipients (comma-separated)
    if (typeof mailgunData.recipient === "string") {
      const recipients = mailgunData.recipient
        .split(",")
        .map((r: string) => r.trim());
      mailgunData.recipients = recipients;
    }

    // Process the email and generate/send a response
    await emailService.processIncomingEmail(mailgunData);

    return NextResponse.json(
      { message: "Email processed successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing Mailgun webhook:", error);
    return NextResponse.json(
      { message: "Error processing webhook", error: String(error) },
      { status: 500 }
    );
  }
}

// Add HEAD and GET methods to support Mailgun's webhook validation requests
export async function HEAD() {
  return NextResponse.json({}, { status: 200 });
}

export async function GET() {
  return NextResponse.json({}, { status: 200 });
}
