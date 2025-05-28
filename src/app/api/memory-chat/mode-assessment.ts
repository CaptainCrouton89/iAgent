import { OpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { MODE_ASSESSMENT_PROMPT } from "./prompts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function assessChatMode(messages: ChatCompletionMessageParam[]): Promise<string> {
  try {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return 'default';
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      temperature: 0.1,
      messages: [
        { role: "system", content: MODE_ASSESSMENT_PROMPT },
        { role: "user", content: lastMessage.content as string }
      ]
    });

    const mode = response.choices[0]?.message?.content?.trim().toLowerCase();
    return mode === 'brainstorm' ? 'brainstorm' : 'default';
  } catch (error) {
    console.error('Error assessing chat mode:', error);
    return 'default';
  }
}