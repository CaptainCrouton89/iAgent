import axios from "axios";
import Queue from "bull";

// Interface for job data
export interface JobData {
  toolName: string;
  args: Record<string, unknown>;
  agentId: string;
  path: string;
  timestamp?: string;
}

// Interface for job result
export interface JobResult {
  completed: boolean;
  timestamp: string;
  [key: string]: string | number | boolean;
}

// Connect to Redis
const jobQueue = new Queue<JobData>("agent-job-queue", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
});

// Process jobs
jobQueue.process(5, async (job) => {
  try {
    job.progress(0);
    const { toolName, args, agentId, path } = job.data;

    console.log(`Processing job ${job.id} for tool: ${toolName}`);
    console.log(`Tool arguments:`, args);

    // Wait 10 seconds (simulating tool execution)
    await new Promise((resolve) => setTimeout(resolve, 10000));

    job.progress(100);
    console.log(`Job ${job.id} completed`);

    // Ping the agent webhook with the result
    const webhookUrl = `${process.env.AGENT_URL}/${agentId}/webhook/${path}`;
    const response = await axios.post(webhookUrl, {
      success: true,
      data: {
        type: "text",
        text: "Hello world",
      },
    });

    console.log(
      `Webhook notification sent to ${webhookUrl}, status: ${response.status}`
    );

    return {
      completed: true,
      timestamp: new Date().toISOString(),
      webhookStatus: response.status,
    };
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);
    throw error;
  }
});

// Event listeners
jobQueue.on("completed", (job, result) => {
  console.log(`Job ${job.id} has been completed with result:`, result);
});

jobQueue.on("failed", (job, error) => {
  console.error(`Job ${job.id} has failed with error:`, error);
});

jobQueue.on("progress", (job, progress) => {
  console.log(`Job ${job.id} is ${progress}% complete`);
});

export default jobQueue;
