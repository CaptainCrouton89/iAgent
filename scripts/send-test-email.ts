// Import modules
import * as fs from "fs";
import * as mailgunFactory from "mailgun-js";
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

// Function to send a test email
async function sendTestEmail(): Promise<void> {
  const apiKey = process.env.MAILGUN_API_KEY || "";
  const domain = process.env.MAILGUN_DOMAIN || "";

  // Use a properly formatted sender email
  const senderEmail = "Wendy French <wendy@agent-hyve.com>";

  // Email configuration
  const recipientEmail = "test@example.com"; // Replace with your actual email for testing

  console.log("Email configuration:");
  console.log(`- API Key: ${apiKey.substring(0, 5)}...`);
  console.log(`- Domain: ${domain}`);
  console.log(`- Sender: ${senderEmail}`);
  console.log(`- Recipient: ${recipientEmail}`);

  if (!apiKey || !domain) {
    console.error(
      "Missing required configuration. Please check your .env.local file."
    );
    process.exit(1);
  }

  // Initialize Mailgun
  console.log("\nInitializing Mailgun client...");
  const mg = mailgunFactory.default({ apiKey, domain });

  // Prepare email data
  const data = {
    from: senderEmail,
    to: recipientEmail,
    subject: "Test Email from Mailgun API",
    text: "This is a test email sent using the Mailgun API to verify connectivity.",
    html: "<h1>Test Email</h1><p>This is a test email sent using the Mailgun API to verify connectivity.</p>",
  };

  console.log("\nEmail data:", data);

  try {
    console.log("\nSending test email...");

    // Send the email
    const result = await new Promise<mailgunFactory.messages.SendResponse>(
      (resolve, reject) => {
        mg.messages().send(data, (error, body) => {
          if (error) {
            reject(error);
          } else {
            resolve(body);
          }
        });
      }
    );

    console.log("\nEmail sent successfully!");
    console.log("Response:", result);
  } catch (error) {
    console.error("\nFailed to send email:", error);

    // Provide more specific error information
    if (error && typeof error === "object" && "statusCode" in error) {
      const statusCode = (error as { statusCode: number }).statusCode;
      const message = (error as { message?: string }).message;

      console.log(`\nError code: ${statusCode}`);
      if (message) console.log(`Error message: ${message}`);

      if (statusCode === 400) {
        console.log(
          "\nPossible solution: There is an issue with the email format or parameters."
        );
        console.log(
          '1. Make sure the "from" address is in the format "Name <email@domain.com>'
        );
        console.log(
          '2. Verify that the "from" email domain matches your Mailgun domain'
        );
        console.log("3. Check if all required fields are correctly formatted");
      } else if (statusCode === 401) {
        console.log(
          "\nPossible solution: Your API key may be invalid or has insufficient permissions."
        );
        console.log(
          "1. Verify that your API key is correctly copied from the Mailgun dashboard"
        );
        console.log("2. Check if your account is active and not suspended");
        console.log(
          '3. Make sure your API key has the "Send" permission enabled'
        );
      } else if (statusCode === 403) {
        console.log(
          "\nPossible solution: Your account may be limited or the domain is not properly verified."
        );
        console.log("1. Check if your domain is properly verified in Mailgun");
        console.log(
          "2. If using a sandbox domain, make sure the recipient is authorized"
        );
        console.log("3. Verify that your account is in good standing");
      }
    }

    process.exit(1);
  }
}

// Run the function
sendTestEmail().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
