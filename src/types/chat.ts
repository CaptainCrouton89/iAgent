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
  thinkingDepth?: number;
  memorySearchRequired?: boolean;
  interactionLessons?: string[];
  consciousThought?: string | null;
}

export type ChatStatus = "ready" | "loading" | "error";

export interface StreamEvent {
  type:
    | "text-delta"
    | "tool-call-streaming-start"
    | "tool-call-delta"
    | "tool-call-complete"
    | "tool-result"
    | "finish"
    | "error";
  textDelta?: string;
  toolCallId?: string;
  toolName?: string;
  argsTextDelta?: string;
  args?: unknown;
  result?: unknown;
  finishReason?: string;
  error?: string;
}
