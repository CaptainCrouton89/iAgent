interface SystemInfoArgs {
  type: string;
}

interface SearchMemoriesArgs {
  query: string;
  threshold?: number;
  limit?: number;
}

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  state: "call" | "result" | "partial-call";
  args: unknown;
  result?: string;
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
          <p>System info: {toolInvocation.result}</p>
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
          <p className="text-sm font-medium mt-2">Memory Search Results:</p>
          <pre className="text-xs whitespace-pre-wrap mt-1">
            {toolInvocation.result || "No result provided."}
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
