export interface ReasoningState {
  premises: string[];
  currentHypothesis: string | null;
  openQuestions: string[];
  actions: string[];
  thread: string[];
  goal: string;
  confidenceLevel: number;
  contradictions: string[];
  lastStateUpdate: string;
  iterationCount: number;
  reasoningMode: 'logical' | 'creative' | 'hybrid';
}

export interface ReasoningStep {
  type: 'premise' | 'hypothesis' | 'question' | 'action' | 'conclusion' | 'evidence' | 'idea' | 'connection' | 'experiment' | 'synthesis';
  content: string;
  confidence: number;
  references: string[];
  timestamp: string;
  parentStep?: string;
}

export interface ReasoningOutput {
  thoughts: string[];
  state: ReasoningState;
  steps: ReasoningStep[];
  needsContinuation: boolean;
  qualityScore: number;
}

export interface HypothesisTest {
  hypothesis: string;
  evidence: string[];
  supportingEvidence: string[];
  contradictingEvidence: string[];
  confidence: number;
  status: 'testing' | 'supported' | 'refuted' | 'inconclusive';
}

export interface MemorySearchContext {
  hypothesis?: string;
  openQuestions: string[];
  evidenceType?: 'supporting' | 'contradicting' | 'neutral';
  reasoningGoal: string;
}

export interface ReasoningMetrics {
  coherenceScore: number;
  evidenceQuality: number;
  goalAlignment: number;
  contradictionCount: number;
  stepCount: number;
}

export const createInitialReasoningState = (goal: string, mode: ReasoningState['reasoningMode'] = 'logical'): ReasoningState => ({
  premises: [],
  currentHypothesis: null,
  openQuestions: [],
  actions: [],
  thread: [],
  goal,
  confidenceLevel: 0.5,
  contradictions: [],
  lastStateUpdate: new Date().toISOString(),
  iterationCount: 0,
  reasoningMode: mode
});

export const updateReasoningState = (
  state: ReasoningState,
  updates: Partial<ReasoningState>
): ReasoningState => ({
  ...state,
  ...updates,
  lastStateUpdate: new Date().toISOString(),
  iterationCount: state.iterationCount + 1
});