import OpenAI from "openai";

const decoder = new TextDecoder();

export async function processThoughtsInBackground(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  messageHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
): Promise<{
  getNewThoughtFlag: () => boolean;
  thoughtsPromise: Promise<void>;
}> {
  let newThoughtFromStreamAvailable = false;
  const thoughtsPromise = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("[ThoughtsReader] Thoughts stream finished.");
          break;
        }
        const thoughtChunk = decoder.decode(value, { stream: true }).trim();
        if (thoughtChunk) {
          messageHistory.push({
            role: "developer",
            content: `<internal_thought>${thoughtChunk}</internal_thought>`,
          });
          console.log(
            `[ThoughtsReader] Added thought to message history: "${thoughtChunk.slice(
              0,
              100
            )}..."`
          );
          newThoughtFromStreamAvailable = true; // Signal new thought
        }
      }
    } catch (error) {
      console.error("[ThoughtsReader] Error reading thoughts stream:", error);
    } finally {
      reader.releaseLock();
      console.log("[ThoughtsReader] Reader lock released.");
    }
  })();
  return {
    getNewThoughtFlag: () => {
      if (newThoughtFromStreamAvailable) {
        newThoughtFromStreamAvailable = false; // Reset flag after checking
        return true;
      }
      return false;
    },
    thoughtsPromise,
  };
}
