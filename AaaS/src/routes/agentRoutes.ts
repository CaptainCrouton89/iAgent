import { Router } from "express";
import agentController from "../controllers/agentController";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

/**
 * @route POST /api/agents/chat
 * @desc Chat with an agent
 * @access Public
 */
router.post("/chat", asyncHandler(agentController.chatWithAgent));
router.post(
  "/:agentId/webhook/:toolName",
  asyncHandler(agentController.handleWebhook)
);

export default router;
