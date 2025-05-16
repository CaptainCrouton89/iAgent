import { useCallback, useState } from "react";

export function useControlledCompletion(apiUrl = "/api/ai/conscious/chat") {
  const [isLoading, setIsLoading] = useState(false);
  const [completion, setCompletion] = useState("");
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (prompt: string) => {
      setIsLoading(true);
      setCompletion("");
      setError(null);

      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          body: JSON.stringify({ prompt }),
        });

        if (!res.ok || !res.body) throw new Error("Failed to fetch stream");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          setCompletion((prev) => prev + chunk);
        }
      } catch (err: unknown) {
        console.error("Streaming error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    },
    [apiUrl]
  );

  return {
    generate,
    completion,
    isLoading,
    error,
  };
}
