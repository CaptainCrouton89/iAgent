import { BaseTool, ToolResult, toolRegistry } from "./baseTool";

export class HelloWorldTool extends BaseTool {
  readonly name = "helloWorld";
  readonly description =
    "A simple tool that returns a greeting message with optional delay";
  readonly callback = "helloWorld";
  async execute({
    name,
    delay = 0,
  }: {
    name: string;
    delay?: number;
  }): Promise<ToolResult> {
    try {
      // If there's a delay, simulate some async processing
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay * 1000));
      }

      return {
        success: true,
        data: {
          type: "text",
          text: `Hello, ${name}! ${
            delay > 0 ? `(after waiting ${delay} seconds)` : ""
          }`,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// Register the tool
const helloWorldTool = new HelloWorldTool();
toolRegistry.registerTool(helloWorldTool);
