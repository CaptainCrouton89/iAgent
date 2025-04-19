# iAgent Email Assistant

An AI-powered email assistant that can generate intelligent responses to emails with web search capabilities.

## Features

- Generate contextual email responses using AI
- Web search capability powered by Perplexity API to provide up-to-date information in responses
- Email sending via Mailgun
- Contact management

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   pnpm install
   ```
3. Create a `.env` file with your API keys:

   ```
   # OpenAI API key
   OPENAI_API_KEY=your_openai_api_key

   # Perplexity API key
   PERPLEXITY_API_KEY=your_perplexity_api_key

   # Mailgun credentials
   MAILGUN_API_KEY=your_mailgun_api_key
   MAILGUN_DOMAIN=your_mailgun_domain
   MAILGUN_SENDER=your_sender_email

   # Database connection
   DATABASE_URL=your_database_url
   ```

4. Initialize the database:
   ```
   pnpm init-db
   ```
5. Start the development server:
   ```
   pnpm dev
   ```

## Web Search Integration

The email assistant uses Perplexity API to search the web for up-to-date information when generating email responses. This helps the AI provide accurate and current information in its replies.

### How It Works

1. The system analyzes the incoming email content
2. If the email refers to recent events, products, or facts that need verification
3. The AI uses Perplexity's search capabilities to retrieve current information
4. The response is crafted using both the AI's knowledge and the fresh data from web search

### Example Usage

```typescript
import { AIService } from "./services/aiService";

// Initialize with your Perplexity API key
const aiService = new AIService({
  debug: true,
  perplexityApiKey: process.env.PERPLEXITY_API_KEY,
});

// Generate a response with web search capability
const response = await aiService.generateEmailResponse({
  from: "customer@example.com",
  subject: "Question about recent product update",
  body: "I heard you released a new feature yesterday. Can you tell me more about it?",
});

console.log(response.text); // The AI-generated response
```

## License

MIT
