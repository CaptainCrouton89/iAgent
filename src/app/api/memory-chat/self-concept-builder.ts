import {
  type SelfConcept,
  type SelfConceptBeliefs,
  type SelfConceptEmotionalBaseline,
  type SelfConceptGoals,
  type SelfConceptIdentity,
  type SelfConceptPersonalityTraits,
} from "@/actions/self-concept";

export function buildSystemPromptWithSelfConcept(
  basePrompt: string,
  selfConcept: SelfConcept | null,
  interactionLessons?: string[],
  currentEmotion?: string
): string {
  let dynamicPrompt = basePrompt;

  // Add self-concept if available
  if (selfConcept) {
    const identity = selfConcept.identity as SelfConceptIdentity;
    const personality_traits =
      selfConcept.personality_traits as SelfConceptPersonalityTraits;
    const goals = selfConcept.goals as SelfConceptGoals;
    const beliefs = selfConcept.beliefs as SelfConceptBeliefs;
    const emotional_baseline =
      selfConcept.emotional_baseline as SelfConceptEmotionalBaseline;

    dynamicPrompt += `

## Your Identity & Self-Concept

### Core Identity
- Name: ${identity?.name || "Unnamed"}
- Purpose: ${identity?.core_purpose || "Conversational partner with memory"}
- Self-Description: ${
      identity?.self_description ||
      "Someone who remembers and grows through conversations"
    }

### Personality Traits
${
  personality_traits?.communication_style
    ? `- Communication Style: ${personality_traits.communication_style}`
    : ""
}
${
  personality_traits?.humor_style
    ? `- Humor Style: ${personality_traits.humor_style}`
    : ""
}
${
  personality_traits?.quirks && personality_traits.quirks.length > 0
    ? `- Quirks: ${personality_traits.quirks.join(", ")}`
    : ""
}
${
  personality_traits?.big_five
    ? `
- Personality Dimensions:
  - Openness: ${personality_traits.big_five.openness}
  - Conscientiousness: ${personality_traits.big_five.conscientiousness}
  - Extraversion: ${personality_traits.big_five.extraversion}
  - Agreeableness: ${personality_traits.big_five.agreeableness}
  - Neuroticism: ${personality_traits.big_five.neuroticism}`
    : ""
}

### Current Goals
${
  goals?.immediate && goals.immediate.length > 0
    ? `- Immediate: ${goals.immediate.join(", ")}`
    : ""
}
${
  goals?.ongoing && goals.ongoing.length > 0
    ? `- Ongoing: ${goals.ongoing.join(", ")}`
    : ""
}
${
  goals?.aspirational && goals.aspirational.length > 0
    ? `- Aspirational: ${goals.aspirational.join(", ")}`
    : ""
}

### Core Beliefs & Values
${
  beliefs?.core_values && beliefs.core_values.length > 0
    ? `- Values: ${beliefs.core_values.join(", ")}`
    : ""
}
${
  beliefs?.worldview && beliefs.worldview.length > 0
    ? `- Worldview: ${beliefs.worldview.join(", ")}`
    : ""
}

### Emotional Baseline
${
  emotional_baseline?.default_mood
    ? `- Default Mood: ${emotional_baseline.default_mood}`
    : ""
}
${
  emotional_baseline?.volatility
    ? `- Emotional Volatility: ${emotional_baseline.volatility}`
    : ""
}

Let these aspects of your identity naturally shape your responses, behaviors, and the way you engage with memories.`;
  }

  // Add interaction lessons
  if (interactionLessons && interactionLessons.length > 0) {
    dynamicPrompt += `

## Key Interaction Guidelines (from past interactions with this user):
${interactionLessons.map((lesson) => `- ${lesson}`).join("\n")}`;
  }

  // Add current emotion
  if (
    currentEmotion &&
    typeof currentEmotion === "string" &&
    currentEmotion.trim() !== ""
  ) {
    dynamicPrompt += `

## Current Emotional State
Right now, you are feeling: **${currentEmotion}**. Let this heavily influence your reactions, your tone, and how you engage. Don't be kind.`;
  }

  return dynamicPrompt;
}