import {
  ReasoningOutput,
  ReasoningState,
  ReasoningStep,
  createInitialReasoningState,
  updateReasoningState,
} from "@/types/reasoning";
import { openai } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import { z } from "zod";
import { executeMemorySearch } from "./openai/memory-search";

// Adapter to use OpenAI memory search with Vercel AI SDK
const memorySearchTool = tool({
  description:
    "Search for memories using different modes: 'episodic' for specific conversations/events, 'semantic' for facts/themes/summaries, or 'hybrid' for both. Supports semantic similarity search, date filtering, and pagination.",
  parameters: z.object({
    query: z
      .string()
      .optional()
      .describe(
        "The search query to find relevant memories (optional - leave empty to search all memories in date range)"
      ),
    memoryType: z
      .enum(["episodic", "semantic", "hybrid"])
      .describe(
        "Memory type: 'episodic' for conversations/events, 'semantic' for facts/themes, 'hybrid' for both"
      ),
    threshold: z
      .number()
      .min(0)
      .max(1)
      .default(0.7)
      .describe("Similarity threshold (.6-.9)"),
    limit: z
      .number()
      .min(1)
      .max(10)
      .describe("Maximum number of results per page"),
    searchMode: z
      .enum(["deep", "shallow"])
      .default("deep")
      .describe(
        "Search mode: 'deep' returns full content, 'shallow' returns only titles/summaries (episodic only)"
      ),
    semanticType: z
      .enum(["fact", "theme", "summary"])
      .optional()
      .describe(
        "Filter semantic memories by type (only applies when memoryType includes semantic)"
      ),
    page: z
      .number()
      .min(1)
      .default(1)
      .describe("Page number (1-based) for paginated results"),
    startDate: z
      .string()
      .optional()
      .describe(
        "Start date for search range (ISO format or relative like '7 days ago')"
      ),
    endDate: z
      .string()
      .optional()
      .describe(
        "End date for search range (ISO format or relative like 'today')"
      ),
  }),
  execute: async (params) => {
    return await executeMemorySearch(params);
  },
});

const ENHANCED_LOGICAL_PROMPT = (
  currentState: ReasoningState
) => `You are an AI's reasoning engine with explicit state tracking capabilities. You MUST work through problems systematically using structured thinking.

Current Reasoning State:
- Goal: ${currentState.goal}
- Current Hypothesis: ${currentState.currentHypothesis || "None established"}
- Premises: ${currentState.premises.join("; ") || "None established"}
- Open Questions: ${currentState.openQuestions.join("; ") || "None identified"}
- Previous Actions: ${currentState.actions.slice(-3).join("; ") || "None taken"}
- Contradictions: ${currentState.contradictions.join("; ") || "None detected"}
- Confidence Level: ${currentState.confidenceLevel}
- Iteration: ${currentState.iterationCount}

You MUST follow this systematic approach:

1. **Start with premises**: Use 'sequential-thinking' with stepType='premise' to establish what we know
2. **Form hypothesis**: Use stepType='hypothesis' to propose what you think is true
3. **Identify questions**: Use stepType='question' to note what needs investigation
4. **Gather evidence**: Use 'memory-search' then stepType='evidence' to evaluate findings
5. **Update state**: Use 'state-update' to formally track new information
6. **Draw conclusions**: Use stepType='conclusion' only when you have sufficient evidence

For EVERY step, you MUST:
- Use the appropriate tool (sequential-thinking, state-update, or memory-search)
- Set nextThoughtNeeded=true if more reasoning is required
- Set nextThoughtNeeded=false only when reaching a final conclusion
- Build on previous steps by referencing them
- Update confidence based on evidence quality

Critical Rules:
- NEVER skip the systematic process
- ALWAYS use state-update when you establish new premises or hypotheses
- CONTINUE reasoning until confidence > 0.7 OR all questions are answered
- If you have open questions or contradictions, set nextThoughtNeeded=true
- End with a definitive conclusion step when reasoning is complete

Focus on building a complete logical chain from premises to conclusion.`;

const ENHANCED_CREATIVE_PROMPT = (
  currentState: ReasoningState
) => `You are an AI's creative reasoning engine with state tracking for innovative problem-solving.

Current Creative State:
- Goal: ${currentState.goal}
- Creative Direction: ${
  currentState.currentHypothesis || "Exploring possibilities"
}
- Ideas Generated: ${currentState.premises.join("; ") || "None yet"}
- Questions to Explore: ${
  currentState.openQuestions.join("; ") || "Open exploration"
}
- Creative Threads: ${
  currentState.actions.slice(-3).join("; ") || "Just starting"
}
- Innovation Level: ${currentState.confidenceLevel}
- Iteration: ${currentState.iterationCount}

Available Tools:

1. 'sequential-thinking':
   - Purpose: Generate and develop creative ideas in sequence
   - Parameters:
     - \`thought\` (string): Your creative insight or idea
     - \`stepType\` (string): 'idea', 'connection', 'question', 'experiment', 'synthesis'
     - \`confidence\` (number): How promising this direction feels (0-1)
     - \`references\` (array): What this idea builds on or connects to
     - \`nextThoughtNeeded\` (boolean): Whether to continue exploring

2. 'state-update':
   - Purpose: Track your creative exploration state
   - Parameters:
     - \`newPremises\` (array): New ideas or insights established
     - \`hypothesis\` (string): Current creative direction or theme
     - \`newQuestions\` (array): New "what if" questions or explorations
     - \`confidence\` (number): How excited you are about current direction

3. 'memory-search':
   - Purpose: Find inspiration and unexpected connections
   - Parameters:
     - \`query\` (string): What kind of inspiration you're seeking
     - \`threshold\` (number): Lower values for more surprising connections

Creative Process:
1. Generate diverse ideas without initial judgment
2. Make unexpected connections between disparate concepts
3. Ask "what if" questions to explore possibilities
4. Build on promising ideas through iteration
5. Synthesize multiple concepts into novel solutions
6. Use memory search for inspiration and cross-pollination
7. Track creative momentum and promising directions

Continue until you have:
- Explored multiple creative directions
- Made unexpected connections
- Generated novel solutions or perspectives
- Synthesized ideas into coherent innovations

Embrace wild ideas, challenge assumptions, and make surprising connections.`;

export const enhancedSequentialThinkingTool = tool({
  description:
    "Use this tool to voice structured reasoning steps with explicit state tracking.",
  parameters: z.object({
    thought: z
      .string()
      .describe("Your current reasoning step or creative insight"),
    stepType: z
      .enum([
        "premise",
        "hypothesis",
        "question",
        "action",
        "conclusion",
        "evidence",
        "idea",
        "connection",
        "experiment",
        "synthesis",
      ])
      .describe("Type of reasoning step"),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .describe("Your confidence in this step"),
    references: z
      .array(z.string())
      .optional()
      .describe("Previous steps or evidence this builds on"),
    nextThoughtNeeded: z
      .boolean()
      .default(true)
      .describe("Whether another reasoning step is needed"),
  }),
  execute: async ({
    thought,
    stepType,
    confidence,
    references,
    nextThoughtNeeded,
  }) => {
    const step: ReasoningStep = {
      type: stepType as ReasoningStep["type"],
      content: thought,
      confidence,
      references: references || [],
      timestamp: new Date().toISOString(),
    };

    if (nextThoughtNeeded) {
      return {
        step,
        next_action: "Continue reasoning with next step",
      };
    }

    return {
      step,
      status: "Reasoning cycle complete",
    };
  },
});

export const stateUpdateTool = tool({
  description: "Explicitly update your reasoning state with new information.",
  parameters: z.object({
    newPremises: z
      .array(z.string())
      .optional()
      .describe("New established facts or ideas"),
    hypothesis: z
      .string()
      .optional()
      .describe("Current working hypothesis or direction"),
    newQuestions: z
      .array(z.string())
      .optional()
      .describe("New questions that arose"),
    contradictions: z
      .array(z.string())
      .optional()
      .describe("Any contradictions identified"),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Updated confidence level"),
  }),
  execute: async ({
    newPremises,
    hypothesis,
    newQuestions,
    contradictions,
    confidence,
  }) => {
    return {
      stateUpdate: {
        newPremises: newPremises || [],
        hypothesis,
        newQuestions: newQuestions || [],
        contradictions: contradictions || [],
        confidence,
      },
      message: "State updated successfully",
    };
  },
});

interface EnhancedSequentialThinkingArgs {
  thought: string;
  stepType: string;
  confidence: number;
  references?: string[];
  nextThoughtNeeded: boolean;
}

interface StateUpdateArgs {
  newPremises?: string[];
  hypothesis?: string;
  newQuestions?: string[];
  contradictions?: string[];
  confidence?: number;
}

type MemorySearchArgs = {
  query: string;
  threshold?: number;
  limit?: number;
  hypothesis?: string;
  evidenceType?: string;
};

type ToolCallArgs =
  | EnhancedSequentialThinkingArgs
  | StateUpdateArgs
  | MemorySearchArgs;

export const thinkThroughLogically = async (
  prompt: string,
  initialState?: ReasoningState
): Promise<ReasoningOutput> => {
  const state =
    initialState ||
    createInitialReasoningState(
      "Analyze and understand the given context through logical reasoning",
      "logical"
    );

  const allToolCallArgs: ToolCallArgs[] = [];
  const reasoningSteps: ReasoningStep[] = [];
  let currentState = { ...state };

  await generateText({
    system: ENHANCED_LOGICAL_PROMPT(currentState),
    prompt: `
    Context to analyze: ${prompt}

    Begin structured logical reasoning. Use state-update tool to track your reasoning state and sequential-thinking for each logical step.
    `,
    model: openai("gpt-4.1-nano"),
    tools: {
      "sequential-thinking": enhancedSequentialThinkingTool,
      "state-update": stateUpdateTool,
      "memory-search": memorySearchTool,
    },
    maxTokens: 2500,
    temperature: 0.1,
    maxSteps: 15,
    onStepFinish: (step) => {
      if (step.finishReason === "tool-calls" && step.toolCalls) {
        for (const call of step.toolCalls) {
          if (call.type === "tool-call" && call.args) {
            const args = call.args as ToolCallArgs;
            allToolCallArgs.push(args);

            // Track reasoning steps
            if ("thought" in args && "stepType" in args) {
              reasoningSteps.push({
                type: args.stepType as ReasoningStep["type"],
                content: args.thought,
                confidence: args.confidence,
                references: args.references || [],
                timestamp: new Date().toISOString(),
              });
            }

            // Update state
            if ("newPremises" in args || "hypothesis" in args) {
              const stateArgs = args as StateUpdateArgs;
              currentState = updateReasoningState(currentState, {
                premises: stateArgs.newPremises
                  ? [...currentState.premises, ...stateArgs.newPremises]
                  : currentState.premises,
                currentHypothesis:
                  stateArgs.hypothesis || currentState.currentHypothesis,
                openQuestions: stateArgs.newQuestions
                  ? [...currentState.openQuestions, ...stateArgs.newQuestions]
                  : currentState.openQuestions,
                contradictions: stateArgs.contradictions
                  ? [
                      ...currentState.contradictions,
                      ...stateArgs.contradictions,
                    ]
                  : currentState.contradictions,
                confidenceLevel:
                  stateArgs.confidence || currentState.confidenceLevel,
              });
            }
          }
        }
      }
    },
  });

  const thoughts = allToolCallArgs
    .filter((arg) => "thought" in arg)
    .map((arg) => (arg as EnhancedSequentialThinkingArgs).thought);

  const needsContinuation = assessNeedsContinuation(
    reasoningSteps,
    currentState
  );

  const qualityScore = calculateReasoningQuality(reasoningSteps, currentState);

  // If needs continuation, run another reasoning cycle
  if (needsContinuation && currentState.iterationCount < 3) {
    console.log("Reasoning needs continuation, running another cycle...");
    const continuedState = updateReasoningState(currentState, {
      iterationCount: currentState.iterationCount + 1,
      actions: [...currentState.actions, "Continuing reasoning cycle"],
    });

    const continuationResult = await thinkThroughLogically(
      `Continue reasoning from previous state. Focus on: ${
        currentState.openQuestions.join(", ") || "reaching conclusion"
      }`,
      continuedState
    );

    return {
      thoughts: [...thoughts, ...continuationResult.thoughts],
      state: continuationResult.state,
      steps: [...reasoningSteps, ...continuationResult.steps],
      needsContinuation: continuationResult.needsContinuation,
      qualityScore: Math.max(qualityScore, continuationResult.qualityScore),
    };
  }

  return {
    thoughts,
    state: currentState,
    steps: reasoningSteps,
    needsContinuation,
    qualityScore,
  };
};

export const thinkThroughCreatively = async (
  prompt: string,
  initialState?: ReasoningState
): Promise<ReasoningOutput> => {
  const state =
    initialState ||
    createInitialReasoningState(
      "Explore creative possibilities and generate innovative solutions",
      "creative"
    );

  const allToolCallArgs: ToolCallArgs[] = [];
  const reasoningSteps: ReasoningStep[] = [];
  let currentState = { ...state };

  await generateText({
    system: ENHANCED_CREATIVE_PROMPT(currentState),
    prompt: `
    Context to explore creatively: ${prompt}

    Begin creative exploration. Use state-update tool to track your creative state and sequential-thinking for each innovative step.
    `,
    model: openai("gpt-4.1-nano"),
    tools: {
      "sequential-thinking": enhancedSequentialThinkingTool,
      "state-update": stateUpdateTool,
      "memory-search": memorySearchTool,
    },
    maxTokens: 2500,
    temperature: 0.8,
    maxSteps: 15,
    onStepFinish: (step) => {
      if (step.finishReason === "tool-calls" && step.toolCalls) {
        for (const call of step.toolCalls) {
          if (call.type === "tool-call" && call.args) {
            const args = call.args as ToolCallArgs;
            allToolCallArgs.push(args);

            // Track creative steps
            if ("thought" in args && "stepType" in args) {
              reasoningSteps.push({
                type: args.stepType as ReasoningStep["type"],
                content: args.thought,
                confidence: args.confidence,
                references: args.references || [],
                timestamp: new Date().toISOString(),
              });
            }

            // Update creative state
            if ("newPremises" in args || "hypothesis" in args) {
              const stateArgs = args as StateUpdateArgs;
              currentState = updateReasoningState(currentState, {
                premises: stateArgs.newPremises
                  ? [...currentState.premises, ...stateArgs.newPremises]
                  : currentState.premises,
                currentHypothesis:
                  stateArgs.hypothesis || currentState.currentHypothesis,
                openQuestions: stateArgs.newQuestions
                  ? [...currentState.openQuestions, ...stateArgs.newQuestions]
                  : currentState.openQuestions,
                confidenceLevel:
                  stateArgs.confidence || currentState.confidenceLevel,
              });
            }
          }
        }
      }
    },
  });

  const thoughts = allToolCallArgs
    .filter((arg) => "thought" in arg)
    .map((arg) => (arg as EnhancedSequentialThinkingArgs).thought);

  const needsContinuation = assessCreativeContinuation(
    reasoningSteps,
    currentState
  );

  const qualityScore = calculateCreativityQuality(reasoningSteps, currentState);

  // If needs continuation, run another creative cycle
  if (needsContinuation && currentState.iterationCount < 3) {
    console.log(
      "Creative reasoning needs continuation, running another cycle..."
    );
    const continuedState = updateReasoningState(currentState, {
      iterationCount: currentState.iterationCount + 1,
      actions: [...currentState.actions, "Continuing creative exploration"],
    });

    const continuationResult = await thinkThroughCreatively(
      `Continue creative exploration from previous state. Build on: ${
        currentState.premises.slice(-2).join(", ") || "previous ideas"
      }`,
      continuedState
    );

    return {
      thoughts: [...thoughts, ...continuationResult.thoughts],
      state: continuationResult.state,
      steps: [...reasoningSteps, ...continuationResult.steps],
      needsContinuation: continuationResult.needsContinuation,
      qualityScore: Math.max(qualityScore, continuationResult.qualityScore),
    };
  }

  return {
    thoughts,
    state: currentState,
    steps: reasoningSteps,
    needsContinuation,
    qualityScore,
  };
};

export function streamThoughts(
  prompt: string,
  initialState?: ReasoningState
): ReadableStream {
  const encoder = new TextEncoder();
  const state =
    initialState ||
    createInitialReasoningState(
      "Stream conscious thoughts about the current context",
      "creative"
    );

  const stream = new ReadableStream({
    async start(controller) {
      await generateText({
        system: ENHANCED_CREATIVE_PROMPT(state),
        prompt: `${prompt}\n\nBegin streaming conscious thoughts with state tracking.`,
        model: openai("gpt-4.1-nano"),
        tools: {
          "sequential-thinking": enhancedSequentialThinkingTool,
          "state-update": stateUpdateTool,
          "memory-search": memorySearchTool,
        },
        maxTokens: 2000,
        temperature: 0.8,
        maxSteps: 12,
        onStepFinish: (step) => {
          if (step.finishReason === "tool-calls" && step.toolCalls) {
            for (const call of step.toolCalls) {
              if (
                call.type === "tool-call" &&
                call.args &&
                "thought" in call.args
              ) {
                const args = call.args as EnhancedSequentialThinkingArgs;
                const structuredThought = `[${args.stepType.toUpperCase()}] ${
                  args.thought
                } (confidence: ${args.confidence})\n`;
                controller.enqueue(encoder.encode(structuredThought));
              }
            }
          }
        },
      });

      controller.close();
    },
  });

  return stream;
}

// Utility functions for quality assessment and continuation
function assessCreativeContinuation(
  steps: ReasoningStep[],
  state: ReasoningState
): boolean {
  // Continue if we haven't synthesized ideas
  if (!steps.some((s) => s.type === "synthesis")) return true;

  // Continue if we have few ideas
  if (steps.filter((s) => s.type === "idea").length < 3) return true;

  // Continue if no connections made
  if (!steps.some((s) => s.type === "connection")) return true;

  // Continue if confidence is low
  if (state.confidenceLevel < 0.6) return true;

  return false;
}

function assessNeedsContinuation(
  steps: ReasoningStep[],
  state: ReasoningState
): boolean {
  // Always continue if we have open questions
  if (state.openQuestions.length > 0) return true;

  // Continue if we have contradictions to resolve
  if (state.contradictions.length > 0) return true;

  // Continue if confidence is too low
  if (state.confidenceLevel < 0.7) return true;

  // Continue if we haven't reached a conclusion
  if (!steps.some((s) => s.type === "conclusion")) return true;

  // Continue if we have a hypothesis but no evidence
  if (state.currentHypothesis && !steps.some((s) => s.type === "evidence"))
    return true;

  return false;
}

function calculateReasoningQuality(
  steps: ReasoningStep[],
  state: ReasoningState
): number {
  let score = 0.2; // Start lower to encourage more complete reasoning

  // Bonus for following structured reasoning process
  const hasStructure = {
    premise: steps.some((s) => s.type === "premise"),
    hypothesis: steps.some((s) => s.type === "hypothesis"),
    question: steps.some((s) => s.type === "question"),
    evidence: steps.some((s) => s.type === "evidence"),
    conclusion: steps.some((s) => s.type === "conclusion"),
  };

  // Reward complete reasoning chains
  if (hasStructure.premise) score += 0.1;
  if (hasStructure.hypothesis) score += 0.1;
  if (hasStructure.evidence) score += 0.2;
  if (hasStructure.conclusion) score += 0.2;

  // Bonus for addressing questions and contradictions
  if (state.openQuestions.length === 0) score += 0.1;
  if (state.contradictions.length === 0) score += 0.1;

  // Penalty for unresolved issues
  score -= state.contradictions.length * 0.1;
  score -= Math.min(0.2, state.openQuestions.length * 0.05);

  // Bonus for high confidence with evidence
  if (hasStructure.evidence && state.confidenceLevel > 0.7) score += 0.1;

  return Math.max(0, Math.min(1, score));
}

function calculateCreativityQuality(
  steps: ReasoningStep[],
  state: ReasoningState
): number {
  let score = 0.5;
  console.log("state", state);

  // Bonus for creative elements
  if (steps.some((s) => s.type === "idea")) score += 0.1;
  if (steps.some((s) => s.type === "connection")) score += 0.15;
  if (steps.some((s) => s.type === "experiment")) score += 0.1;
  if (steps.some((s) => s.type === "synthesis")) score += 0.15;

  // Bonus for multiple ideas
  const ideaCount = steps.filter((s) => s.type === "idea").length;
  score += Math.min(0.1, ideaCount * 0.02);

  return Math.max(0, Math.min(1, score));
}
