# AI-Powered Email Reply Service

This service automatically generates and sends AI-powered email replies using Mailgun and Vercel AI SDK.

## Features

- Webhook endpoint for receiving emails from Mailgun
- AI-powered email reply generation using OpenAI's GPT-4o
- Automatic email sending via Mailgun

## Setup

### 1. Install Dependencies

```bash
pnpm add mailgun-js @types/mailgun-js
```

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Mailgun credentials:

```
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-mailgun-domain.com
EMAIL_SENDER=Your Assistant <assistant@yourdomain.com>
```

### 3. Configure Mailgun Webhook

1. Log in to your Mailgun dashboard
2. Navigate to "Receiving" > "Routes"
3. Create a new route with an action to forward to your webhook URL
   - Example: `https://yourdomain.com/api/webhooks/mailgun`
4. Save the route

## How It Works

1. When an email is received at your Mailgun domain, Mailgun forwards it to your webhook endpoint
2. The webhook endpoint extracts the email details and passes them to the email service
3. The email service generates an AI-powered reply using Vercel AI SDK and GPT-4o
4. The email service sends the reply back to the original sender

## API Reference

### EmailService

The `EmailService` class provides the following methods:

#### `writeReply(emailData: EmailData): Promise<string>`

Generates an AI-powered reply to an email.

Parameters:

- `emailData`: Object containing email details (from, subject, body)

Returns:

- A promise that resolves to the generated reply text

#### `sendReply(emailData: EmailData, replyContent: string): Promise<mailgun.messages.SendResponse>`

Sends an email reply using Mailgun.

Parameters:

- `emailData`: Object containing email details (subject, recipient, originalEmailId)
- `replyContent`: The text content of the reply

Returns:

- A promise that resolves to the Mailgun send response

#### `processIncomingEmail(mailgunData: MailgunWebhookPayload): Promise<void>`

Processes an incoming email from Mailgun, generates a reply, and sends it.

Parameters:

- `mailgunData`: The webhook payload from Mailgun

## Webhook Endpoint

The webhook endpoint is available at `/api/webhooks/mailgun` and supports:

- `POST`: Processes incoming emails
- `GET` and `HEAD`: Required for Mailgun webhook validation

## Customization

You can customize the AI prompt in the `writeReply` method to change how the AI responds to emails.

## Security Considerations

In production, you should validate the Mailgun webhook signature to ensure requests are coming from Mailgun. This implementation includes a placeholder for this validation.
