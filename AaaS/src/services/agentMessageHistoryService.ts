import dotenv from "dotenv";
import { agentMessageHistoryRepository } from "../repositories";
import { AgentMessageHistory } from "../types/database";

dotenv.config();

/**
 * Service to handle agent message history operations
 */
export class AgentMessageHistoryService {
  /**
   * Get a message by its ID
   * @param messageId The message ID
   * @returns The message or null if not found
   */
  public async getMessageById(messageId: string) {
    return await agentMessageHistoryRepository.findById(messageId);
  }

  /**
   * Get all messages
   * @returns An array of all messages
   */
  public async getAllMessages() {
    return await agentMessageHistoryRepository.findAll();
  }

  /**
   * Create a new message
   * @param message The message data
   * @returns The created message
   */
  public async createMessage(message: Partial<AgentMessageHistory>) {
    return await agentMessageHistoryRepository.create(message);
  }

  /**
   * Update an existing message
   * @param messageId The message ID
   * @param message The updated message data
   * @returns The updated message or null if not found
   */
  public async updateMessage(
    messageId: string,
    message: Partial<AgentMessageHistory>
  ) {
    return await agentMessageHistoryRepository.update(messageId, message);
  }

  /**
   * Delete a message
   * @param messageId The message ID
   * @returns True if successfully deleted
   */
  public async deleteMessage(messageId: string) {
    return await agentMessageHistoryRepository.delete(messageId);
  }

  /**
   * Get all messages for a specific agent
   * @param agentId The agent ID
   * @returns Array of messages for the specified agent
   */
  public async getMessagesByAgentId(agentId: string) {
    return await agentMessageHistoryRepository.findByAgentId(agentId);
  }
}

export default new AgentMessageHistoryService();
