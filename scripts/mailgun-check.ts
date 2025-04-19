// Import directly from mailgun-js with CommonJS syntax
import * as fs from "fs";
import * as mailgunFactory from "mailgun-js";
import * as path from "path";

// Load environment variables directly from the file
const envPath = path.resolve(process.cwd(), ".env.local");
console.log("Trying to load env from:", envPath);

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
}

async function checkMailgunCredentials(): Promise<void> {
  const apiKey = process.env.MAILGUN_API_KEY || "";
  const domain = process.env.MAILGUN_DOMAIN || "";

  console.log("Checking Mailgun credentials");
  console.log(`API Key (first 5 chars): ${apiKey.substring(0, 5)}...`);
  console.log(`Domain: ${domain}`);

  if (!apiKey) {
    console.error("MAILGUN_API_KEY is not set in environment variables");
    process.exit(1);
  }

  if (!domain) {
    console.error("MAILGUN_DOMAIN is not set in environment variables");
    process.exit(1);
  }

  // Create a mailgun instance with the provided credentials
  const mailgun = mailgunFactory.default({ apiKey, domain });

  try {
    console.log("Testing API key with a domain info request...");

    // Try to get domain information which will test the API key
    const domainInfo = await new Promise<unknown>((resolve, reject) => {
      mailgun.get(`/domains/${domain}`, (err, body) => {
        if (err) {
          reject(err);
        } else {
          resolve(body);
        }
      });
    });

    console.log("API Key is valid! Domain info:", domainInfo);
    return;
  } catch (error) {
    console.error("Mailgun API key validation failed:", error);
    console.log("\nPossible issues:");
    console.log("1. Invalid API key");
    console.log("2. API key does not have permission to access this domain");
    console.log("3. Domain is not properly configured in Mailgun");
    console.log("4. Network connectivity issues");

    // Suggest solution based on status code
    if (error && typeof error === "object" && "statusCode" in error) {
      const statusCode = (error as { statusCode: number }).statusCode;
      if (statusCode === 401) {
        console.log(
          "\nSolution: The API key is invalid or has expired. Generate a new API key in your Mailgun dashboard and update your .env.local file."
        );
      } else if (statusCode === 404) {
        console.log(
          "\nSolution: The domain does not exist or is not associated with this API key. Verify the domain in your Mailgun dashboard."
        );
      }
    }

    process.exit(1);
  }
}

// Run the check and handle any unexpected errors
checkMailgunCredentials().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
