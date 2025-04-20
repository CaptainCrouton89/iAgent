import { JsonToolResponse as JsonToolResponseType, Message } from "../types";

/**
 * Checks if a string is valid JSON
 */
export const isJsonString = (str: string): boolean => {
  try {
    const result = JSON.parse(str);
    return result && typeof result === "object";
  } catch {
    // Try to parse as multiple JSON objects
    return containsMultipleJsonObjects(str);
  }
};

/**
 * Checks if a string contains multiple valid JSON objects
 */
export const containsMultipleJsonObjects = (str: string): boolean => {
  // Look for multiple JSON objects pattern (each starting with { and ending with })
  const jsonPattern = /\{[\s\S]*?\}/g;
  const matches = str.match(jsonPattern);

  if (!matches || matches.length <= 0) {
    return false;
  }

  // Try to parse each potential JSON object
  return matches.some((jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      return parsed && typeof parsed === "object";
    } catch {
      return false;
    }
  });
};

/**
 * Extracts multiple JSON objects from a string
 */
export const extractJsonObjects = (str: string): JsonToolResponseType[] => {
  const jsonPattern = /\{[\s\S]*?\}/g;
  const matches = str.match(jsonPattern) || [];

  return matches
    .map((jsonStr) => {
      try {
        const parsed = JSON.parse(jsonStr);
        // Check if this looks like a valid tool response
        if (
          parsed &&
          typeof parsed === "object" &&
          "toolName" in parsed &&
          "toolCallId" in parsed &&
          "data" in parsed
        ) {
          return parsed as JsonToolResponseType;
        }
        return null;
      } catch {
        return null;
      }
    })
    .filter((obj): obj is JsonToolResponseType => obj !== null);
};

/**
 * Normalize a string that might have "data:" prefix (from EventSource)
 */
export const normalizeEventData = (str: string): string => {
  const dataPrefix = "data:";
  return str.startsWith(dataPrefix)
    ? str.substring(dataPrefix.length).trim()
    : str.trim();
};

/**
 * Checks if a string might be a complete messages array
 * and extracts tool responses from it if present
 */
export const extractToolResponsesFromMessagesArray = (
  str: string
): JsonToolResponseType[] => {
  try {
    // Normalize the data by removing "data:" prefix if present
    const normalizedStr = normalizeEventData(str);

    // Try to parse as JSON array of messages
    const parsedArray = JSON.parse(normalizedStr);
    if (Array.isArray(parsedArray)) {
      // Look for user messages with JSON tool responses in their content
      for (const msgObj of parsedArray) {
        if (
          msgObj.role === "user" &&
          typeof msgObj.content === "string" &&
          msgObj.content.includes("{") &&
          msgObj.content.includes("}")
        ) {
          // Extract JSON objects from the message content
          const jsonResponses = extractJsonObjects(msgObj.content);
          if (jsonResponses.length > 0) {
            return jsonResponses;
          }
        }
      }
    }
    return [];
  } catch (err) {
    console.error("Error extracting tool responses from messages array:", err);
    return [];
  }
};

/**
 * Checks if a string might be a complete messages array
 */
export const isMessagesArray = (str: string): boolean => {
  try {
    // Normalize the data by removing "data:" prefix if present
    const normalizedStr = normalizeEventData(str);

    // Try to parse as JSON array
    const parsed = JSON.parse(normalizedStr);
    // Check if it's an array with at least one message object
    return (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every(
        (item) =>
          typeof item === "object" && "role" in item && "content" in item
      )
    );
  } catch {
    return false;
  }
};

/**
 * Checks if a message should be displayed as coming from the assistant
 */
export const isDisplayedAsAssistant = (message: Message): boolean => {
  // Check if it's an assistant or tool message
  if (message.role === "assistant" || message.role === "tool") return true;

  // Check if it's a JSON tool response (coming from user message)
  if (message.role === "user" && typeof message.content === "string") {
    const content = message.content.trim();

    // Check if content is a JSON array
    if (content.startsWith("[") && content.endsWith("]")) {
      try {
        const parsedArray = JSON.parse(content);
        if (Array.isArray(parsedArray) && parsedArray.length > 0) {
          // Check if the array contains valid tool responses
          return parsedArray.some(
            (item) =>
              item &&
              typeof item === "object" &&
              "toolName" in item &&
              "toolCallId" in item &&
              "data" in item &&
              (typeof item.success === "boolean" || "success" in item)
          );
        }
      } catch (e) {
        // If parsing fails, continue with other checks
        console.error("Error parsing potential JSON array:", e);
      }
    }

    // First check if it contains tool response JSON objects
    if (containsMultipleJsonObjects(content)) {
      const jsonObjects = extractJsonObjects(content);
      if (jsonObjects.length > 0) {
        // Verify these are legitimate tool responses (not just any JSON)
        const validToolResponses = jsonObjects.filter(
          (obj) =>
            obj.toolName &&
            obj.toolCallId &&
            obj.data &&
            (typeof obj.success === "boolean" || "success" in obj)
        );
        return validToolResponses.length > 0;
      }
    }

    // Check if it matches the legacy tool ID pattern (for backward compatibility)
    const toolIdPattern = /^\[\w+: ToolId: \d+\]/;
    return toolIdPattern.test(content);
  }

  return false;
};
