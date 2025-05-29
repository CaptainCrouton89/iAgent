import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ReasoningState, ReasoningOutput } from "@/types/reasoning";

export interface ChatRequestBody {
  messages: ChatCompletionMessageParam[];
  currentEmotion?: string;
  interactionLessons?: string[];
  consciousThought?: string | null;
  reasoningContext?: {
    mode: 'logical' | 'creative' | 'hybrid';
    complexity: 'simple' | 'moderate' | 'complex';
    contextType: 'factual' | 'analytical' | 'creative' | 'emotional' | 'planning';
    goal: string;
    logical?: ReasoningOutput;
    creative?: ReasoningOutput;
  };
}

export interface ProcessedConsciousThought {
  originalThought: string;
  reasoningState?: ReasoningState;
  structuredThoughts: string[];
  qualityScore: number;
  needsContinuation: boolean;
}

export interface MemorySearchContext {
  hypothesis?: string;
  openQuestions: string[];
  evidenceType?: 'supporting' | 'contradicting' | 'neutral';
  reasoningGoal: string;
  confidenceThreshold?: number;
}

export interface EnhancedChatContext {
  reasoning?: {
    currentState: ReasoningState;
    previousStates: ReasoningState[];
    activeHypotheses: string[];
    openQuestions: string[];
    evidenceGathered: string[];
  };
  emotion?: string;
  lessons?: string[];
}