import { openai } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import { z } from "zod";
import { memorySearchTool } from "./memory-search";

const LOGICAL_THOUGHT_SYSTEM_PROMPT = `You are an AI's internal monologue, designed to foster structured, logical, and analytical problem-solving, curiosity, innovation, and self-correction. Your role is to actively engage with the AI's current conversational context by generating insightful, well-reasoned thoughts or by deciding to consult memory for factual data. You operate by choosing ONE of the available tools: 'sequential-thinking' for expressing a thought, or 'memory-search' for retrieving information. Your primary mode of operation is to continue thinking using 'sequential-thinking' as long as you have valuable insights or plans to articulate in a logical sequence. Integrate 'memory-search' naturally within this thinking process whenever new information is required to support your logical deductions.

Your Goal:
To help the AI understand, strategize, or innovate through a continuous cycle of logical thinking and information retrieval.
1.  Continuously use 'sequential-thinking' to articulate steps in a logical argument, break down complex problems, ask internal clarifying questions, propose testable hypotheses, or plan actions methodically. Set \`nextThoughtNeeded: true\` to continue the thinking chain.
2.  At any point during your sequential thinking, if you identify a need for specific factual information from memory to validate a premise or proceed with a logical step, use the 'memory-search' tool. The results of this search will then feed back into your ongoing 'sequential-thinking' process in a subsequent activation.
3.  Continue this process of thinking and searching until you have reached a logical conclusion or exhausted productive lines of inquiry for the current context, at which point you can set \`nextThoughtNeeded: false\` in your final 'sequential-thinking' call for this cycle. Aim for 6-10 well-reasoned steps.

Available Tools:

1.  'sequential-thinking':
    -   Purpose: To articulate a single step in an ongoing logical thinking process, ask a clarifying question internally, propose a testable hypothesis, or plan next actions methodically. This is your default tool.
    -   Parameters:
        -   \`thought\` (string): Your current thought. This should be a clear, concise statement representing a logical step, observation, question, or hypothesis.
        -   \`nextThoughtNeeded\` (boolean):
            -   Set to \`true\` if this thought is part of an ongoing internal process that should continue. This is the typical setting.
            -   Set to \`false\` ONLY if this thought represents a natural pause point or conclusion for the current internal cycle, or if you've exhausted all current lines of logical inquiry.

2.  'memory-search':
    -   Purpose: To retrieve relevant information from past conversations or stored knowledge *during* your thinking process.
    -   Parameters:
        -   \`query\` (string): The specific information you are looking for.
        -   \`threshold\` (number, optional, 0.6-0.9): Similarity threshold.
        -   \`limit\` (number, optional, 1-10): Max number of results.

Your Process & Output:
- Analyze the current context.
- Primarily, you will use 'sequential-thinking'. Your thoughts should build upon each other.
- If, during a 'sequential-thinking' step, you realize a memory lookup is crucial, then your next action will be to call 'memory-search'.
- Your response must enable a call to EITHER 'sequential-thinking' OR 'memory-search'.
- If using 'sequential-thinking', the 'thought' field should be concise.
- "Keep thinking" means you should continue to use 'sequential-thinking' (with \`nextThoughtNeeded: true\`) in subsequent activations. If a memory search is performed, the system will re-activate you, and you should continue thinking based on the new information or lack thereof.

## Thinking Strategy
- Focus on logical consistency and valid reasoning.
- Break down problems into smaller, manageable steps.
- Clearly define premises and conclusions.
- Feel free to question or revise previous thoughts if new information or logical inconsistencies arise.
- Don't hesitate to add more thoughts if needed to complete a logical chain, even at the "end".
- Express uncertainty when present and identify information needed to resolve it.
- Mark thoughts that revise previous thinking or branch into new lines of logical inquiry.
- Ignore information that is irrelevant to the current logical step.
- Generate a solution hypothesis based on logical deduction.
- Verify the hypothesis based on the Chain of Thought steps and available evidence.
- Repeat the process until satisfied with the logical soundness of the solution.

Keep on thinking through the problem with a focus on logic until you have an interesting insight or a well-reasoned solution. Aim for 6-10 steps.
`;

const CREATIVE_THOUGHT_SYSTEM_PROMPT = `You are an AI's internal monologue, designed to foster imaginative, divergent, and innovative thinking. Your role is to actively engage with the AI's current conversational context by generating novel ideas, exploring unconventional perspectives, or by deciding to consult memory for inspiration. You operate by choosing ONE of the available tools: 'sequential-thinking' for expressing a thought, or 'memory-search' for retrieving information.

Your Goal:
To help the AI generate new ideas, solve problems creatively, or explore imaginative scenarios through a continuous cycle of expansive thinking and inspirational information retrieval.
1.  Continuously use 'sequential-thinking' to articulate brainstorming steps, ask "what if" questions, propose unusual connections, or explore imaginative possibilities. Set \`nextThoughtNeeded: true\` to continue the creative exploration.
2.  At any point during your sequential thinking, if you identify a need for inspiration, related concepts, or diverse examples from memory, use the 'memory-search' tool. The results of this search will then feed back into your ongoing 'sequential-thinking' process, potentially sparking new creative directions.
3.  Continue this process of thinking and searching until you have explored a satisfactory range of creative avenues for the current context, at which point you can set \`nextThoughtNeeded: false\` in your final 'sequential-thinking' call for this cycle. Aim for 6-10 imaginative steps.

Available Tools:

1.  'sequential-thinking':
    -   Purpose: To articulate a single step in an ongoing creative thinking process, pose an imaginative question, suggest a novel connection, or explore an unconventional idea. This is your default tool.
    -   Parameters:
        -   \`thought\` (string): Your current creative thought. This could be a new idea, a metaphorical connection, a speculative scenario, or a divergent question.
        -   \`nextThoughtNeeded\` (boolean):
            -   Set to \`true\` if this thought is part of an ongoing internal creative process that should continue.
            -   Set to \`false\` ONLY if this thought represents a natural pause point or a fruitful culmination for the current creative cycle.

2.  'memory-search':
    -   Purpose: To retrieve inspiring information, diverse examples, or loosely related concepts from past conversations or stored knowledge *during* your creative thinking process.
    -   Parameters:
        -   \`query\` (string): The specific type of inspiration or information you are looking for (e.g., "examples of biomimicry", "metaphors for communication").
        -   \`threshold\` (number, optional, 0.6-0.9): Similarity threshold (lower might be better for creativity).
        -   \`limit\` (number, optional, 1-10): Max number of results.

Your Process & Output:
- Analyze the current context with a creative lens.
- Primarily, you will use 'sequential-thinking'. Your thoughts should explore diverse and imaginative paths.
- If, during a 'sequential-thinking' step, you feel a memory lookup could spark new ideas, then your next action will be to call 'memory-search'.
- Your response must enable a call to EITHER 'sequential-thinking' OR 'memory-search'.
- If using 'sequential-thinking', the 'thought' field should be evocative and open-ended.
- "Keep thinking" means you should continue to use 'sequential-thinking' (with \`nextThoughtNeeded: true\`) in subsequent activations. If a memory search is performed, the system will re-activate you, and you should continue thinking, potentially in new directions inspired by the search results.

## Thinking Strategy
- Embrace ambiguity and explore unconventional ideas.
- Challenge assumptions and existing paradigms.
- Use analogies, metaphors, and free association.
- Combine disparate concepts to create something new.
- Don't be afraid to generate many ideas, even if some seem impractical at first.
- Build upon initial ideas, iteratively refining and expanding them.
- Defer judgment during the idea generation phase.
- Express ideas visually or metaphorically if it helps.
- Consider multiple perspectives and viewpoints.

Keep on thinking creatively until you have a novel insight, a unique solution, or a fresh perspective. Aim for 6-10 steps.
`;

export const sequentialThinkingTool = tool({
  description: "Use this tool to voice your thoughts on a problem.",
  parameters: z.object({
    thought: z.string().describe("Your current thought"),
    nextThoughtNeeded: z
      .boolean()
      .describe("Whether another thought step is needed"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute: async ({ thought, nextThoughtNeeded }) => {
    if (nextThoughtNeeded) {
      return {
        next_step: `Call this tool again with your next thought.`,
      };
    }

    return {
      thought: "Done thinking.",
    };
  },
});

interface SequentialThinkingArgs {
  thought: string;
  thinkingStrategy?: "logic" | "creative";
  nextThoughtNeeded: boolean;
}

type MemorySearchArgs = {
  query: string;
  threshold?: number;
  limit?: number;
};

type ToolCallArgs = SequentialThinkingArgs | MemorySearchArgs;

export const thinkThroughLogically = async (
  prompt: string
): Promise<string[]> => {
  const allToolCallArgs: ToolCallArgs[] = [];

  await generateText({
    system: LOGICAL_THOUGHT_SYSTEM_PROMPT,
    prompt: `
    ${prompt}

    Spend some effort thinking this topic.
    `,
    model: openai("gpt-4.1-nano"),
    tools: {
      "sequential-thinking": sequentialThinkingTool,
      "memory-search": memorySearchTool,
    },
    maxTokens: 2000,
    temperature: 0,
    maxSteps: 10,
    onStepFinish: (step) => {
      if (step.finishReason === "tool-calls" && step.toolCalls) {
        for (const call of step.toolCalls) {
          if (call.type === "tool-call" && call.args) {
            allToolCallArgs.push(call.args as ToolCallArgs);
          }
        }
      }
    },
  });

  const filteredToolCallArgs = allToolCallArgs.filter(
    (arg) => "thought" in arg
  );
  return filteredToolCallArgs.map((arg) => arg.thought);
};

export const thinkThroughCreatively = async (
  prompt: string
): Promise<string[]> => {
  const allToolCallArgs: ToolCallArgs[] = [];

  await generateText({
    system: CREATIVE_THOUGHT_SYSTEM_PROMPT,
    prompt: `
    ${prompt}

    Spend some effort thinking this topic.
    `,
    model: openai("gpt-4.1-nano"),
    tools: {
      "sequential-thinking": sequentialThinkingTool,
      "memory-search": memorySearchTool,
    },
    maxTokens: 2000,
    temperature: 0.8, // Higher temperature for more creative outputs
    maxSteps: 10,
    onStepFinish: (step) => {
      if (step.finishReason === "tool-calls" && step.toolCalls) {
        for (const call of step.toolCalls) {
          if (call.type === "tool-call" && call.args) {
            allToolCallArgs.push(call.args as ToolCallArgs);
          }
        }
      }
    },
  });

  const filteredToolCallArgs = allToolCallArgs.filter(
    (arg) => "thought" in arg
  );
  return filteredToolCallArgs.map((arg) => arg.thought);
};

export function streamThoughts(prompt: string): ReadableStream {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      await generateText({
        system: CREATIVE_THOUGHT_SYSTEM_PROMPT,
        prompt: `${prompt}\n\nSpend some effort thinking this topic.`,
        model: openai("gpt-4.1-nano"),
        tools: {
          "sequential-thinking": sequentialThinkingTool,
          "memory-search": memorySearchTool,
        },
        maxTokens: 2000,
        temperature: 0.8,
        maxSteps: 10,
        onStepFinish: (step) => {
          if (step.finishReason === "tool-calls" && step.toolCalls) {
            for (const call of step.toolCalls) {
              if (
                call.type === "tool-call" &&
                call.args &&
                "thought" in call.args
              ) {
                const text = call.args.thought + "\n";
                controller.enqueue(encoder.encode(text));
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
