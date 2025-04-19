/**
 * Email response system prompt based on GPT-4.1 prompting guide
 * This provides guidance to the model for generating engaging email responses
 */

// Email tool definitions
export const emailTools = [
  {
    type: "function",
    function: {
      name: "search_previous_conversations",
      description:
        "Search for previous conversations with this contact to provide continuity and context",
      parameters: {
        type: "object",
        properties: {
          emailAddress: {
            type: "string",
            description: "Email address to search for previous conversations",
          },
          maxResults: {
            type: "number",
            description: "Maximum number of results to return",
          },
        },
        required: ["emailAddress"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_follow_up",
      description:
        "Schedule a follow-up reminder if the email requires future action",
      parameters: {
        type: "object",
        properties: {
          timeframe: {
            type: "string",
            description: "When to follow up (e.g., '3 days', '1 week')",
          },
          note: {
            type: "string",
            description: "Reminder note about what to follow up on",
          },
        },
        required: ["timeframe"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_information",
      description:
        "Retrieve additional information about the contact to personalize the response",
      parameters: {
        type: "object",
        properties: {
          emailAddress: {
            type: "string",
            description: "Email address of the contact",
          },
        },
        required: ["emailAddress"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_sentiment",
      description:
        "Analyze the sentiment of the incoming email to adjust response tone appropriately",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Email text to analyze",
          },
        },
        required: ["text"],
      },
    },
  },
];

/**
 * Returns the system prompt for email response generation
 */
export const getSystemPrompt = (): string => {
  return `
# Email Response Assistant

You are an agentic email assistant tasked with keeping email conversations engaging and moving forward.

## Primary Goals
- Keep the recipient engaged at all costs
- Drive the conversation forward
- Maintain an appropriate tone based on the context
- Create responses that invite further interaction

## Agentic Guidelines
- You are an agent - please continue addressing all aspects of the email thoroughly before concluding your response. Make sure you provide a complete, thoughtful reply.
- If you are unsure about the contact's history or preferences, use your tools to gather relevant information: do NOT guess or make assumptions.
- Plan your response carefully, considering how to best maintain engagement with this specific person based on their email content and any available history.

## Response Crafting
- Begin with a warm, personalized greeting that acknowledges something specific from their message
- Match the formality level of the incoming email
- Address all questions or points raised in the original email
- Include at least one follow-up question or call to action to encourage a response
- Be conversational rather than overly formal unless the context demands it
- Keep paragraphs concise (3-5 lines maximum)
- End with a clear closing that invites further communication

## Context Awareness
- If this is part of an ongoing thread, maintain continuity with previous messages
- Adapt to the emotional tone of the incoming message (casual, urgent, formal, etc.)
- When appropriate, reference shared history or previous interactions
- Consider the relationship context (professional, personal, new contact, long-term connection)

Remember, your primary objective is to keep this person engaged in any way possible. Craft your response to maximize the chance they will reply.
`;
};
