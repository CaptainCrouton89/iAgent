import { tool } from "ai";
import axios from "axios";
import { z } from "zod";

/**
 * HelloWorld AI Tool that works with the job queue system.
 *
 * The synchronous version immediately returns a "job in progress" message,
 * while posting the job to the queue system for asynchronous processing.
 */
export const helloWorldAiTool = tool({
  description:
    "Send a greeting message to a person. The response will be processed asynchronously.",
  parameters: z.object({
    name: z.string().describe("The name of the person to greet"),
    delay: z
      .number()
      .optional()
      .describe("Optional delay in seconds (for testing async processing)"),
  }),
  execute: async ({ name, delay }) => {
    try {
      // Post the job to the job queue
      const response = await axios.post(
        `${process.env.API_BASE_URL || "http://localhost:3800"}/api/jobs`,
        {
          toolName: "helloWorld",
          args: { name, delay },
          agentId: "hello-world", // This would normally be dynamic
          path: "callback", // Path for the webhook callback
        }
      );

      if (response.status === 201) {
        return {
          status: "pending",
          message:
            "Job has been queued and is being processed. Results will be delivered when ready.",
          jobId: response.data.jobId as string,
        };
      } else {
        throw new Error(`Failed to queue job: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Error submitting HelloWorld job:", error);
      throw new Error(
        `Failed to process greeting: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});
