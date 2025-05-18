export async function inspectAndMaybeRePromptWithDirective(
  buffer: string
): Promise<{ shouldRePrompt: boolean; next: string } | null> {
  const asyncInsight = await someAsyncLogicWithDirective(buffer);
  if (asyncInsight.shouldRePrompt) {
    console.log(
      "[Checkpoint] Re-prompting with instruction:",
      asyncInsight.next
    );
    return {
      shouldRePrompt: asyncInsight.shouldRePrompt,
      next: asyncInsight.next,
    };
  }
  return null; // keep going with current stream
}

export async function inspectAndMaybeRePrompt(
  buffer: string
): Promise<{ shouldRePrompt: boolean; next: string } | null> {
  const asyncInsight = await someAsyncLogic(buffer);

  if (asyncInsight.shouldRePrompt) {
    console.log(
      "[Checkpoint] Re-prompting with instruction:",
      asyncInsight.next
    );
    return {
      shouldRePrompt: asyncInsight.shouldRePrompt,
      next: asyncInsight.next,
    };
  }
  return null; // keep going with current stream
}

const thoughts = ["I wonder how many apples I can fit in my mouth"];

const directives = ["talk about apples", "Get angry"];

let i = 0;
let j = 0;
export async function someAsyncLogic(text: string) {
  // You could call another API, run a tool, check DB, etc.
  console.log("[Checkpoint] Async logic done");
  i++;
  i = i % thoughts.length;
  return {
    shouldRePrompt: text.includes("fridge magnet"), // example condition
    next: `${thoughts[i]}`,
  };
}

async function someAsyncLogicWithDirective(text: string) {
  console.log("[Checkpoint] Async directive done");
  j++;
  j = j % directives.length;
  return {
    shouldRePrompt: text.includes("cantaloupe"), // example condition
    next: `${directives[j]}`,
  };
}
