import * as fs from "fs";
import fetch from "node-fetch";
import * as path from "path";

// Load environment variables directly from the file
const envPath = path.resolve(process.cwd(), ".env.local");
console.log("Loading environment from:", envPath);

// Manually load environment variables from .env.local
try {
  const envContent = fs.readFileSync(envPath, "utf8");
  const envLines = envContent.split("\n");

  for (const line of envLines) {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join("=").trim();
      process.env[key] = value;
    }
  }
  console.log("Environment variables loaded successfully");
} catch (error) {
  console.error("Failed to load .env.local file:", error);
  process.exit(1);
}

async function testWebhook(): Promise<void> {
  // Assuming you're running your application locally on port 3000
  const webhookUrl = "http://localhost:3000/api/webhook/mailgun";

  console.log(`Testing webhook at: ${webhookUrl}`);

  // Create a URLSearchParams object to simulate Mailgun's webhook
  const formData = new URLSearchParams();

  // Add the required fields for the webhook
  formData.append("sender", "test@example.com");
  formData.append("recipient", "the-mind@agent-hyve.com");
  formData.append("subject", "Test Webhook Email");
  formData.append(
    "body-plain",
    "This is a test email sent to test the webhook."
  );
  formData.append(
    "stripped-text",
    "This is a test email sent to test the webhook."
  );
  formData.append("Message-Id", "<test-message-id@example.com>");
  formData.append("from", "Test User <test@example.com>");

  try {
    console.log("Sending webhook test request...");

    // Send the webhook test request
    const response = await fetch(webhookUrl, {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Mailgun-Signature": "test-signature",
        "X-Mailgun-Token": "test-token",
        "X-Mailgun-Timestamp": Date.now().toString(),
      },
    });

    // Parse the response
    const responseData = await response.json();

    console.log(`Response status: ${response.status}`);
    console.log("Response data:", responseData);

    if (response.ok) {
      console.log("Webhook test successful!");
    } else {
      console.error("Webhook test failed.");
    }
  } catch (error) {
    console.error("Error testing webhook:", error);
    process.exit(1);
  }
}

// Run the test
testWebhook().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
