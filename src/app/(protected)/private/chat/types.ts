export type ToolArgs = Record<string, string | number | boolean | null>;

export type ToolResult = {
  success: boolean;
  data: string | object;
  type: "json" | "markdown";
  [key: string]: unknown;
};

export type ContentItem =
  | { type: "text"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: ToolArgs }
  | {
      type: "tool-result";
      toolCallId: string;
      toolName: string;
      result: ToolResult;
    };

export type Message = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string | ContentItem[];
};

export type JsonToolData = {
  type: string;
  text: string;
  timestamp?: string;
  [key: string]: unknown;
};

export type JsonToolResponse = {
  success: boolean;
  toolName: string;
  toolCallId: string;
  data: JsonToolData;
  [key: string]: unknown;
};
