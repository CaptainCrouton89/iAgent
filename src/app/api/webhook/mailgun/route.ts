import { EmailService } from "@/services/emailService";
import { NextResponse } from "next/server";

// Initialize the email service
const emailService = new EmailService();

export async function POST(req: Request) {
  try {
    // Verify this is a valid Mailgun webhook request
    // In production, you should validate the webhook signature using Mailgun's signing key

    // Parse the form data from Mailgun
    const formData = await req.formData();

    console.log("formData", formData);

    // Convert FormData to a regular object
    const mailgunData: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        mailgunData[key] = value;
      }
    }

    // Ensure required fields are present
    if (!mailgunData.sender || !mailgunData.recipient || !mailgunData.subject) {
      return NextResponse.json(
        { message: "Missing required email fields" },
        { status: 400 }
      );
    }

    // Process the email and generate/send a response
    await emailService.processIncomingEmail({
      sender: mailgunData.sender,
      recipient: mailgunData.recipient,
      subject: mailgunData.subject,
      "body-plain": mailgunData["body-plain"],
      "body-html": mailgunData["body-html"],
      "Message-Id": mailgunData["Message-Id"],
      ...mailgunData,
    });

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
