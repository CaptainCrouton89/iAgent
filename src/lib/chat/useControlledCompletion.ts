import OpenAI from "openai";
import { useCallback, useState } from "react";

export function useControlledCompletion(apiUrl = "/api/ai/conscious/chat") {
  const [isLoading, setIsLoading] = useState(false);
  const [completion, setCompletion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [messageHistory, setMessageHistory] = useState<
    OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  >([]);

  const generate = useCallback(
    async (
      newMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
    ) => {
      setIsLoading(true);
      setCompletion("");
      setError(null);

      const updatedHistory = [...messageHistory, ...newMessages];
      setMessageHistory(updatedHistory);

      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          body: JSON.stringify({
            messages: updatedHistory, // Send the whole history
          }),
        });

        if (!res.ok || !res.body) throw new Error("Failed to fetch stream");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let currentCompletionChunk = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          setCompletion((prev) => prev + chunk);
          currentCompletionChunk += chunk;
        }

        // Add the assistant's full response to the history
        if (currentCompletionChunk.trim()) {
          setMessageHistory((prevHistory) => [
            ...prevHistory,
            { role: "assistant", content: currentCompletionChunk },
          ]);
        }
      } catch (err: unknown) {
        console.error("Streaming error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    },
    [apiUrl, messageHistory]
  );

  // Function to manually add messages to history (e.g., user messages)
  const addUserMessage = useCallback((content: string) => {
    const userMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
      role: "user",
      content,
    };
    setMessageHistory((prev) => [...prev, userMessage]);
    // Optionally, you could trigger generate here if you want the AI to respond immediately
    // generate([userMessage]);
  }, []);

  // Function to clear history
  const clearHistory = useCallback(() => {
    setMessageHistory([]);
    setCompletion("");
  }, []);

  return {
    generate,
    completion,
    isLoading,
    error,
    messageHistory,
    addUserMessage,
    clearHistory,
    // You might want to expose a way to set the initial history too
    // setInitialHistory: setMessageHistory
  };
}
