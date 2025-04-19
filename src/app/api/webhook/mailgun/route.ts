import { EmailService, MailgunWebhookPayload } from "@/services/emailService";
import crypto from "crypto";
import { NextResponse } from "next/server";

// Initialize the email service
const emailService = new EmailService();

interface MailgunSignature {
  timestamp: string;
  token: string;
  signature: string;
}

function verifyMailgunSignature(
  signatureData: MailgunSignature,
  apiKey: string
): boolean {
  const hmac = crypto.createHmac("sha256", apiKey);
  hmac.update(signatureData.timestamp + signatureData.token);
  const digest = hmac.digest("hex");
  return digest === signatureData.signature;
}

export async function POST(req: Request) {
  try {
    // Parse the form data from Mailgun
    const formData = await req.formData();
    console.log("formData", formData);

    // Extract signature verification components from the request
    const timestamp = formData.get("timestamp") as string;
    const token = formData.get("token") as string;
    const signature = formData.get("signature") as string;

    // Get your Mailgun API key from environment variable
    const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || "";

    // Verify the Mailgun signature
    if (!timestamp || !token || !signature) {
      return NextResponse.json(
        { message: "Missing signature verification data" },
        { status: 401 }
      );
    }

    const isValid = verifyMailgunSignature(
      { timestamp, token, signature },
      MAILGUN_API_KEY
    );

    if (!isValid) {
      return NextResponse.json(
        { message: "Invalid signature" },
        { status: 401 }
      );
    }

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
