export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "developer" | "tool";
  content?: string;
  parts?: MessagePart[];
  createdAt?: Date;
  tool_call_id?: string;
}

export type MessagePart = 
  | { type: "text"; text: string }
  | { type: "tool-invocation"; toolInvocation: ToolInvocation };

export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  result?: unknown;
  state: "call" | "partial-call" | "result";
}

export interface ChatRequestBody {
  messages: Message[];
  currentEmotion?: string;
  interactionLessons?: string[];
  consciousThought?: string | null;
}

export type ChatStatus = "ready" | "loading" | "error";

export interface StreamEvent {
  type: "text-delta" | "tool-call-streaming-start" | "tool-call-delta" | "tool-result" | "finish" | "error";
  textDelta?: string;
  toolCallId?: string;
  toolName?: string;
  argsTextDelta?: string;
  result?: unknown;
  finishReason?: string;
  error?: string;
}