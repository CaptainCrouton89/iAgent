import { ToolInvocation } from "@/types/chat";

interface SystemInfoArgs {
  type: string;
}

interface SearchMemoriesArgs {
  query: string;
  threshold?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  searchMode?: "deep" | "shallow";
}

interface InspectMemoryArgs {
  memoryId: string;
  startIndex?: number;
  endIndex?: number;
}

interface ToolResponseProps {
  toolInvocation: ToolInvocation;
}

export function ToolResponse({ toolInvocation }: ToolResponseProps) {
  const callId = toolInvocation.toolCallId;

  // Handle different tool types
  switch (toolInvocation.toolName) {
    case "getSystemInfo":
      return renderSystemInfoTool(toolInvocation);
    case "searchMemories":
      return renderSearchMemoriesTool(toolInvocation);
    case "inspectMemory":
      return renderInspectMemoryTool(toolInvocation);
    default:
      return (
        <div key={callId} className="my-2 p-2 border rounded bg-secondary/10">
          <p>Unknown tool: {toolInvocation.toolName}</p>
        </div>
      );
  }
}

function renderSystemInfoTool(toolInvocation: ToolInvocation) {
  const callId = toolInvocation.toolCallId;

  switch (toolInvocation.state) {
    case "call":
      return (
        <div key={callId} className="my-2 p-2 border rounded bg-secondary/20">
          <p>
            Getting system info for:{" "}
            {(toolInvocation.args as SystemInfoArgs).type}...
          </p>
        </div>
      );
    case "result":
      return (
        <div key={callId} className="my-2 p-2 border rounded bg-accent/20">
          <p>System info: {String(toolInvocation.result)}</p>
        </div>
      );
    case "partial-call":
      return (
        <div key={callId} className="my-2 p-2 border border-dashed rounded">
          <p>Tool call in progress...</p>
        </div>
      );
    default:
      return null;
  }
}

function renderSearchMemoriesTool(toolInvocation: ToolInvocation) {
  const callId = toolInvocation.toolCallId;
  const args = toolInvocation.args as SearchMemoriesArgs;

  switch (toolInvocation.state) {
    case "call":
      return (
        <div key={callId} className="my-2 p-2 border rounded bg-secondary/20">
          <p className="text-sm font-medium">Searching memories...</p>
          {args.query && (
            <p className="text-xs text-muted-foreground mt-1">
              Query: &quot;{args.query}&quot;
            </p>
          )}
          {args.threshold !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              Threshold: {args.threshold}
            </p>
          )}
          {args.limit !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              Limit: {args.limit}
            </p>
          )}
        </div>
      );
    case "result":
      return (
        <div key={callId} className="my-2 p-2 border rounded bg-accent/20">
          <p className="text-sm font-medium">Memory Search Invoked With:</p>
          {args.query && (
            <p className="text-xs text-muted-foreground mt-1">
              Query: &quot;{args.query}&quot;
            </p>
          )}
          {args.threshold !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              Threshold: {args.threshold}
            </p>
          )}
          {args.limit !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              Limit: {args.limit}
            </p>
          )}
          {args.startDate && (
            <p className="text-xs text-muted-foreground mt-1">
              Start Date: {args.startDate}
            </p>
          )}
          {args.endDate && (
            <p className="text-xs text-muted-foreground mt-1">
              End Date: {args.endDate}
            </p>
          )}
          {args.page !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              Page: {args.page}
            </p>
          )}
          {args.searchMode && (
            <p className="text-xs text-muted-foreground mt-1">
              Search Mode: {args.searchMode}
            </p>
          )}
          <p className="text-sm font-medium mt-2">Memory Search Results:</p>
          <pre className="text-xs whitespace-pre-wrap mt-1">
            {String(toolInvocation.result || "No result provided.")}
          </pre>
        </div>
      );
    case "partial-call":
      return (
        <div key={callId} className="my-2 p-2 border border-dashed rounded">
          <p>Memory search in progress...</p>
        </div>
      );
    default:
      return null;
  }
}

function renderInspectMemoryTool(toolInvocation: ToolInvocation) {
  const callId = toolInvocation.toolCallId;
  const args = toolInvocation.args as InspectMemoryArgs;

  switch (toolInvocation.state) {
    case "call":
      return (
        <div key={callId} className="my-2 p-2 border rounded bg-secondary/20">
          <p className="text-sm font-medium">Inspecting memory...</p>
          {args.memoryId && (
            <p className="text-xs text-muted-foreground mt-1">
              Memory ID: {args.memoryId.substring(0, 8)}...
            </p>
          )}
          {args.startIndex !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              Start Index: {args.startIndex}
            </p>
          )}
          {args.endIndex !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              End Index: {args.endIndex}
            </p>
          )}
        </div>
      );
    case "result":
      return (
        <div key={callId} className="my-2 p-2 border rounded bg-accent/20">
          <details className="cursor-pointer">
            <summary className="text-sm font-medium">
              Memory Inspection Results
              {args.memoryId && (
                <span className="text-xs text-muted-foreground ml-2">
                  (ID: {args.memoryId.substring(0, 8)}...)
                </span>
              )}
            </summary>
            <pre className="text-xs whitespace-pre-wrap mt-2 p-2 bg-background rounded">
              {String(toolInvocation.result || "No result provided.")}
            </pre>
          </details>
        </div>
      );
    case "partial-call":
      return (
        <div key={callId} className="my-2 p-2 border border-dashed rounded">
          <p>Memory inspection in progress...</p>
        </div>
      );
    default:
      return null;
  }
}
