import { openai } from "@ai-sdk/openai";
import { CoreMessage, generateText } from "ai";
import dotenv from "dotenv";
import { BaseTool } from "../async-tools/baseTool";
import {
  agentMessageHistoryRepository,
  agentRepository,
} from "../repositories";
import { Agent, AgentMessageHistory, Json } from "../types/database";
import { helloWorldAiTool } from "./helloWorldAiTool";

dotenv.config();

/**
 * Service to handle agent chat interactions using Vercel AI SDK
 */
export class AgentService {
  /**
   * Process a chat with the agent
   * @param agentId The agent ID
   * @param messages Previous message history
   * @returns A complete text response from the agent
   */
  public async chatWithAgent(agentId: string, messages: CoreMessage[]) {
    try {
      const agent = await this.getAgentById(agentId);

      if (!agent) {
        throw new Error("Agent not found");
      }

      // Generate a complete text response using OpenAI
      const result = await generateText({
        model: openai("gpt-4o"),
        messages,
        tools: {
          helloWorld: helloWorldAiTool,
        },
        maxSteps: 3, // Allow multiple steps for tool use
      });

      // Store the message in the agent's message history
      await this.storeMessageInHistory(agentId, {
        role: "assistant",
        content: result.text,
      });

      return result;
    } catch (error) {
      console.error("Error in chatWithAgent:", error);
      throw error;
    }
  }

  /**
   * Get an agent by its ID
   * @param agentId The agent ID
   * @returns The agent or null if not found
   */
  public async getAgentById(agentId: string) {
    return await agentRepository.findById(agentId);
  }

  /**
   * Get an agent by its ID along with its message history
   * @param agentId The agent ID
   * @returns The agent with message history or null if not found
   */
  public async getAgentWithMessageHistory(
    agentId: string
  ): Promise<{ agent: Agent; messageHistory: AgentMessageHistory[] } | null> {
    const agent = await agentRepository.findById(agentId);

    if (!agent) {
      return null;
    }

    const messageHistory = await agentMessageHistoryRepository.findByAgentId(
      agentId
    );

    return {
      agent,
      messageHistory,
    };
  }

  public async getAllAgents() {
    return await agentRepository.findAll();
  }

  public async createAgent(agent: Partial<Agent>) {
    return await agentRepository.create(agent);
  }

  public async updateAgent(agentId: string, agent: Partial<Agent>) {
    return await agentRepository.update(agentId, agent);
  }

  public async deleteAgent(agentId: string) {
    return await agentRepository.delete(agentId);
  }

  public async handleWebhook(
    agent: Agent,
    tool: BaseTool,
    body: Record<string, unknown>
  ) {
    const result = await tool.execute(body);

    return result;
  }

  /**
   * Store a message in the agent's message history
   * @param agentId The agent ID
   * @param message The message to store
   * @returns The created message
   */
  private async storeMessageInHistory(
    agentId: string,
    message: {
      role: string;
      content: string;
      metadata?: Json;
    }
  ) {
    return await agentMessageHistoryRepository.create({
      agent_id: agentId,
      role: message.role,
      content: message.content,
      metadata: message.metadata || null,
    });
  }
}

export default new AgentService();
