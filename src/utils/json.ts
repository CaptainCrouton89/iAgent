/**
 * Safely parse a JSON string into an object
 * @param jsonString String to parse
 * @param fallback Fallback value if parsing fails
 * @returns Parsed object or fallback
 */
export function safeParseJson<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return fallback;
  }
}

/**
 * Safely stringify an object to JSON with pretty formatting
 * @param obj Object to stringify
 * @returns Formatted JSON string or empty object string if it fails
 */
export function safeStringifyJson(obj: unknown): string {
  try {
    // Check if obj is already a string that looks like JSON
    if (
      typeof obj === "string" &&
      (obj.startsWith("{") || obj.startsWith("["))
    ) {
      try {
        // Try to parse it to ensure it's valid JSON and re-stringify it
        const parsed = JSON.parse(obj);
        return JSON.stringify(parsed, null, 2);
      } catch {
        // If parsing fails, it's not valid JSON, so just return the original string
        return obj;
      }
    }

    // Normal case: object to JSON string
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    console.error("Error stringifying to JSON:", error);
    return "{}";
  }
}

/**
 * Handle JSON schema changes in tool forms
 * @param value The string value from the editor
 * @returns The parsed object or original string if invalid
 */
export function handleSchemaChange(value: string) {
  try {
    // Parse the JSON string to an object
    return JSON.parse(value);
  } catch {
    // If parsing fails, return the raw string to be handled by the form validation
    return value;
  }
}
