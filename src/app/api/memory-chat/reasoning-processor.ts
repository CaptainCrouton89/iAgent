import { ReasoningState, updateReasoningState } from "@/types/reasoning";
import { ProcessedConsciousThought, MemorySearchContext } from "./types";

/**
 * Processes conscious thought output into structured reasoning data
 */
export function processConsciousThought(
  consciousThought: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _reasoningContext?: unknown
): ProcessedConsciousThought {
  try {
    // Try to parse structured reasoning from conscious output
    const parsed = parseReasoningFromThought(consciousThought);
    
    if (parsed.structured) {
      return {
        originalThought: consciousThought,
        reasoningState: parsed.state,
        structuredThoughts: parsed.thoughts,
        qualityScore: parsed.quality,
        needsContinuation: parsed.needsContinuation
      };
    }
    
    // Fallback: treat as unstructured thought
    return {
      originalThought: consciousThought,
      structuredThoughts: [consciousThought],
      qualityScore: 0.5,
      needsContinuation: false
    };
  } catch (error) {
    console.error("Error processing conscious thought:", error);
    return {
      originalThought: consciousThought,
      structuredThoughts: [consciousThought],
      qualityScore: 0.3,
      needsContinuation: false
    };
  }
}

/**
 * Attempts to parse structured reasoning from conscious thought output
 */
function parseReasoningFromThought(thought: string): {
  structured: boolean;
  state?: ReasoningState;
  thoughts: string[];
  quality: number;
  needsContinuation: boolean;
} {
  // Look for structured reasoning patterns
  const stateMatch = thought.match(/<reasoning_state>([\s\S]*?)<\/reasoning_state>/);
  const thoughtsMatch = thought.match(/<thoughts>([\s\S]*?)<\/thoughts>/);
  const stepMatches = thought.match(/\[(\w+)\]\s*([^[]+)/g);
  
  if (stateMatch || stepMatches) {
    const thoughts: string[] = [];
    let state: ReasoningState | undefined;
    
    if (stepMatches) {
      // Parse structured steps like [PREMISE] content, [HYPOTHESIS] content
      for (const match of stepMatches) {
        const stepMatch = match.match(/\[(\w+)\]\s*(.+)/);
        if (stepMatch) {
          thoughts.push(stepMatch[2].trim());
        }
      }
    }
    
    if (stateMatch) {
      try {
        state = JSON.parse(stateMatch[1]);
      } catch (e) {
        console.warn("Failed to parse reasoning state:", e);
      }
    }
    
    if (thoughtsMatch) {
      const parsedThoughts = thoughtsMatch[1].split('\n').filter(t => t.trim());
      thoughts.push(...parsedThoughts);
    }
    
    return {
      structured: true,
      state,
      thoughts: thoughts.length > 0 ? thoughts : [thought],
      quality: calculateThoughtQuality(thoughts, state),
      needsContinuation: assessContinuationNeed(thoughts, state)
    };
  }
  
  return {
    structured: false,
    thoughts: [thought],
    quality: 0.5,
    needsContinuation: false
  };
}

/**
 * Creates enhanced developer message with reasoning context
 */
export function createReasoningDeveloperMessage(
  processedThought: ProcessedConsciousThought,
  reasoningContext?: unknown
): string {
  const parts: string[] = [];
  
  if (processedThought.reasoningState) {
    parts.push(`<reasoning_state>${JSON.stringify(processedThought.reasoningState)}</reasoning_state>`);
  }
  
  if (reasoningContext && typeof reasoningContext === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = reasoningContext as any;
    if (ctx.logical || ctx.creative) {
      parts.push(`<reasoning_context>${JSON.stringify({
        mode: ctx.mode,
        goal: ctx.goal,
        logical_quality: ctx.logical?.quality,
        creative_quality: ctx.creative?.quality
      })}</reasoning_context>`);
    }
  }
  
  parts.push(`<internal_thoughts>${processedThought.structuredThoughts.join('\n')}</internal_thoughts>`);
  
  if (processedThought.qualityScore < 0.4) {
    parts.push(`<quality_note>Low reasoning quality detected (${processedThought.qualityScore.toFixed(2)}). Consider deeper analysis.</quality_note>`);
  }
  
  if (processedThought.needsContinuation) {
    parts.push(`<continuation_needed>This reasoning chain requires further development</continuation_needed>`);
  }
  
  return parts.join('\n');
}

/**
 * Extracts memory search context from reasoning state
 */
export function extractMemorySearchContext(
  reasoningState?: ReasoningState,
  reasoningContext?: unknown
): MemorySearchContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = reasoningContext as any;
  return {
    hypothesis: reasoningState?.currentHypothesis || undefined,
    openQuestions: reasoningState?.openQuestions || [],
    reasoningGoal: reasoningState?.goal || ctx?.goal || "General information gathering",
    confidenceThreshold: reasoningState?.confidenceLevel || 0.6
  };
}

/**
 * Updates reasoning state based on memory search results
 */
export function updateStateWithMemoryResults(
  currentState: ReasoningState,
  searchResults: string,
  searchQuery: string
): ReasoningState {
  const newActions = [...currentState.actions, `Searched memory: ${searchQuery}`];
  
  // Simple heuristic to detect if results support or contradict hypothesis
  const newPremises = [...currentState.premises];
  const contradictions = [...currentState.contradictions];
  let confidence = currentState.confidenceLevel;
  
  if (currentState.currentHypothesis && searchResults.length > 50) {
    // Check if results seem to support hypothesis (very basic heuristic)
    const hypothesis = currentState.currentHypothesis.toLowerCase();
    const results = searchResults.toLowerCase();
    
    if (results.includes(hypothesis.substring(0, Math.min(hypothesis.length, 20)))) {
      confidence = Math.min(1, confidence + 0.1);
      newPremises.push(`Memory evidence supports: ${searchQuery}`);
    } else if (searchResults.includes("no") || searchResults.includes("not") || searchResults.includes("never")) {
      contradictions.push(`Memory search may contradict hypothesis: ${searchQuery}`);
      confidence = Math.max(0, confidence - 0.05);
    }
  }
  
  return updateReasoningState(currentState, {
    actions: newActions,
    premises: newPremises,
    contradictions,
    confidenceLevel: confidence
  });
}

/**
 * Assesses the quality of conscious thoughts
 */
function calculateThoughtQuality(thoughts: string[], state?: ReasoningState): number {
  let score = 0.5;
  
  // Bonus for structured content
  if (thoughts.some(t => t.includes('hypothesis') || t.includes('premise') || t.includes('evidence'))) {
    score += 0.2;
  }
  
  // Bonus for multiple reasoning steps
  if (thoughts.length > 2) {
    score += 0.1;
  }
  
  // Bonus for state tracking
  if (state) {
    score += 0.1;
    if (state.premises.length > 0) score += 0.05;
    if (state.currentHypothesis) score += 0.05;
  }
  
  return Math.min(1, score);
}

/**
 * Determines if reasoning chain needs continuation
 */
function assessContinuationNeed(thoughts: string[], state?: ReasoningState): boolean {
  if (!state) return false;
  
  // Continue if we have open questions
  if (state.openQuestions.length > 0) return true;
  
  // Continue if we have contradictions to resolve
  if (state.contradictions.length > 0) return true;
  
  // Continue if confidence is low and we have a hypothesis to test
  if (state.currentHypothesis && state.confidenceLevel < 0.6) return true;
  
  // Continue if no conclusion has been reached
  if (!thoughts.some(t => t.toLowerCase().includes('conclusion') || t.toLowerCase().includes('therefore'))) {
    return true;
  }
  
  return false;
}