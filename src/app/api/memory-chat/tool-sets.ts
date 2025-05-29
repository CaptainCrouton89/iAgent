import { memorySearchToolDefinition } from "@/tools/openai/memory-search";
import { memoryInspectToolDefinition } from "@/tools/openai/memory-inspect";
import { ChatCompletionTool } from "openai/resources/chat/completions";

// Perplexity API setup
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";

// Create Perplexity tool definitions for OpenAI
const perplexitySearchTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "searchWeb",
    description: "Search the web for current information using Perplexity API",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to look up on the web"
        }
      },
      required: ["query"]
    }
  }
};

const perplexityDateRangeTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "searchWebWithDateRange",
    description: "Search the web with a specific date range using Perplexity API",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to look up on the web"
        },
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format"
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format"
        }
      },
      required: ["query", "startDate", "endDate"]
    }
  }
};

// Tool execution functions
export const executePerplexitySearch = async (args: Record<string, unknown>) => {
  try {
    const { query } = args as { query: string };
    
    if (!PERPLEXITY_API_KEY) {
      return "Perplexity API key not configured";
    }

    const response = await fetch(`${PERPLEXITY_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: "You are a helpful search assistant. Provide detailed, accurate, and current information.",
          },
          {
            role: "user",
            content: query,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "No results found";
  } catch (error) {
    console.error("Error querying Perplexity API:", error);
    return `Error searching the web: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
};

export const executePerplexityDateRangeSearch = async (args: Record<string, unknown>) => {
  try {
    const { query, startDate, endDate } = args as { query: string; startDate: string; endDate: string };
    
    if (!PERPLEXITY_API_KEY) {
      return "Perplexity API key not configured";
    }

    const response = await fetch(`${PERPLEXITY_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: "You are a helpful search assistant. Provide detailed, accurate, and current information.",
          },
          {
            role: "user",
            content: `Search for information about "${query}" within the date range from ${startDate} to ${endDate}.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "No results found";
  } catch (error) {
    console.error("Error querying Perplexity API with date range:", error);
    return `Error searching the web: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
};

// Tool sets for different modes
export const getToolsForMode = (mode: string): ChatCompletionTool[] => {
  const baseTools = [memorySearchToolDefinition, memoryInspectToolDefinition];
  
  switch (mode) {
    case 'action':
      // Action mode gets all tools for maximum capability
      return [
        ...baseTools,
        perplexitySearchTool,
        perplexityDateRangeTool
      ];
    
    case 'brainstorm':
      // Brainstorm mode gets web search for research
      return [
        ...baseTools,
        perplexitySearchTool
      ];
    
    case 'reflective':
      // Reflective mode focuses on memory tools only
      return baseTools;
    
    default:
      // Default mode gets basic memory tools
      return baseTools;
  }
};

// Tool execution registry
export const toolExecutors = {
  searchWeb: executePerplexitySearch,
  searchWebWithDateRange: executePerplexityDateRangeSearch
};