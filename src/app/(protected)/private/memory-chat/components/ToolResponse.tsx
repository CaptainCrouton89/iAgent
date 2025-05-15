interface SystemInfoArgs {
  type: string;
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
