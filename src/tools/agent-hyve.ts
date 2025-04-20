import { tool } from "ai";
import axios from "axios";
import { z } from "zod";

interface AgentHyveOptions {
  apiKey?: string;
}

export class AgentHyveClient {
  private apiKey: string;

  constructor(options: AgentHyveOptions = {}) {
    this.apiKey = options.apiKey || "";

    if (!this.apiKey) {
      console.warn(
        "Agent Hyve API key not provided. Set AGENT_HYVE_API_KEY env variable or pass in constructor."
      );
    }
  }
  helloWorldTool = tool({
    description: "This is a tool that says hello world",
    parameters: z.object({
      name: z.string().describe("The name to say hello to"),
    }),
    execute: async ({ name }: { name: string }) => {
      const response = await axios.post("http://localhost:3800/api/jobs", {
        toolName: "helloWorld",
        args: {
          name,
        },
      });
      return response.data;
    },
  });
}
