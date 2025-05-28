import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export interface ChatRequestBody {
  messages: ChatCompletionMessageParam[];
  currentEmotion?: string;
  interactionLessons?: string[];
  consciousThought?: string | null;
}