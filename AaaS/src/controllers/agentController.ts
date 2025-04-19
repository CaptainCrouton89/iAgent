import { CoreMessage } from "ai";
import { Request, Response } from "express";
import { toolRegistry } from "../async-tools/baseTool";
import agentService from "../services/agentService";

/**
 * Controller to handle agent related requests
 */
export class AgentController {
  /**
   * Handle chat with agent endpoint
   * @param req Express request object
   * @param res Express response object
   */
  public async chatWithAgent(req: Request, res: Response) {
    try {
      const { messages, agentId } = req.body;

      if (!agentId) {
        return res.status(400).json({ error: "Agent ID is required" });
      }

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      // Validate messages format
      const validMessages = messages.every(
        (msg: { role?: string; content?: string }) =>
          msg.role &&
          typeof msg.role === "string" &&
          msg.content &&
          typeof msg.content === "string"
      );

      if (!validMessages) {
        return res.status(400).json({
          error:
            "Invalid message format. Each message must have role and content properties.",
        });
      }

      // Process the chat using the agent service
      const result = await agentService.chatWithAgent(
        agentId,
        messages as CoreMessage[]
      );

      // Return the complete response
      return res.status(200).json({
        response: result.text,
        usage: result.usage,
      });
    } catch (error) {
      console.error("Error in chatWithAgent controller:", error);
      return res.status(500).json({
        error: "An error occurred while processing the request",
      });
    }
  }

  /**
   * Get an agent by ID
   * @param req Express request object
   * @param res Express response object
   */
  public async getAgentById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const agent = await agentService.getAgentById(id);

      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      return res.status(200).json({ agent });
    } catch (error) {
      console.error("Error in getAgentById controller:", error);
      return res.status(500).json({
        error: "An error occurred while processing the request",
      });
    }
  }

  /**
   * Get an agent by ID with message history
   * @param req Express request object
   * @param res Express response object
   */
  public async getAgentWithMessageHistory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await agentService.getAgentWithMessageHistory(id);

      if (!result) {
        return res.status(404).json({ error: "Agent not found" });
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error("Error in getAgentWithMessageHistory controller:", error);
      return res.status(500).json({
        error: "An error occurred while processing the request",
      });
    }
  }

  public async handleWebhook(req: Request, res: Response) {
    const { agentId, toolName } = req.params;
    const { body } = req;

    const tool = toolRegistry.getTool(toolName);

    if (!tool) {
      return res.status(404).json({ error: "Tool not found" });
    }

    const agent = await agentService.getAgentById(agentId);

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const result = await agentService.handleWebhook(agent, tool, body);

    return res.status(200).json({ result });
  }
}

export default new AgentController();
