import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function* streamOpenAI(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
) {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    temperature: 0.5,
    max_tokens: 1000,
    stream: true,
    messages: messages,
    tools: [
      {
        type: "function",
        function: {
          name: "put_apple_in_mouth",
          description: "Put an apple in your mouth",
          parameters: {
            type: "object",
            properties: {
              count: { type: "integer" },
            },
            required: ["count"],
          },
        },
      },
    ],
  });

  for await (const chunk of response) {
    const delta = chunk.choices?.[0]?.delta;
    if (delta?.content) {
      yield { type: "text", value: delta.content };
    } else if (delta?.tool_calls) {
      // Tool call detected! Pause here.
      const toolCall = delta.tool_calls[0];
      yield { type: "tool_call", value: toolCall };
      return;
    }
  }
}
