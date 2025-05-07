import Markdown from "markdown-to-jsx";
import { ReactNode } from "react";
import {
  ContentItem,
  JsonToolResponse as JsonToolResponseType,
  Message,
  ToolArgs,
  ToolResult,
} from "../types";
import {
  containsMultipleJsonObjects,
  extractJsonObjects,
  parseJsonArray,
} from "../utils/helpers";

// Simplest markdown options - disable HTML parsing completely
const markdownOptions = {
  disableParsingRawHTML: true, // This setting prevents React from trying to render HTML tags in markdown
};

// Component to render tool call content
const ToolCallContent = ({
  toolName,
  args,
}: {
  toolName: string;
  args: ToolArgs;
}) => (
  <div className="border border-gray-200 rounded-md overflow-hidden">
    <div className="bg-blue-50 px-3 py-2 border-l-2 border-l-blue-500 font-medium text-sm text-blue-700">
      Tool Call: {toolName}
    </div>
    <pre className="text-xs bg-white text-gray-800 p-3 m-0 overflow-x-auto border-t border-gray-200">
      {JSON.stringify(args, null, 2)}
    </pre>
  </div>
);

// Component to render tool result content
const ToolResultContent = ({
  toolName,
  result,
}: {
  toolName: string;
  result: ToolResult;
}) => (
  <div className="border border-gray-200 rounded-md overflow-hidden">
    <div className="bg-green-50 px-3 py-2 border-l-2 border-l-green-500 font-medium text-sm text-green-700">
      Tool Result: {toolName}
    </div>
    {result.type === "json" ? (
      <pre className="text-xs bg-white text-gray-800 p-3 m-0 overflow-x-auto border-t border-gray-200">
        {JSON.stringify(result.data, null, 2)}
      </pre>
    ) : (
      <div className="p-3 text-sm border-t border-gray-200 bg-gray-50">
        <div className="markdown-content">
          <Markdown options={markdownOptions}>{result.data as string}</Markdown>
        </div>
      </div>
    )}
  </div>
);

// Component to render JSON tool response
const JsonToolResponse = ({ jsonData }: { jsonData: JsonToolResponseType }) => (
  <div className="border border-gray-200 rounded-md overflow-hidden mb-3">
    <div className="bg-green-50 px-3 py-2 border-l-2 border-l-green-500 font-medium text-sm text-green-700 flex justify-between items-center">
      <span>Tool Result: {jsonData.toolName}</span>
      <span className="text-xs text-gray-500">ID: {jsonData.toolCallId}</span>
    </div>

    <div className="px-3 py-2 border-t border-gray-200 bg-white">
      {jsonData.success ? (
        <span className="text-sm font-medium text-green-600 flex items-center">
          <svg className="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Success
        </span>
      ) : (
        <span className="text-sm font-medium text-red-600 flex items-center">
          <svg className="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          Failed
        </span>
      )}
    </div>

    {typeof jsonData.data === "string" ? (
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="markdown-content">
          <Markdown options={markdownOptions}>{jsonData.data}</Markdown>
        </div>
      </div>
    ) : jsonData.data?.text ? (
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="markdown-content">
          <Markdown options={markdownOptions}>{jsonData.data.text}</Markdown>
        </div>
      </div>
    ) : jsonData.data && typeof jsonData.data === "object" ? (
      <pre className="text-xs bg-white text-gray-800 p-3 m-0 overflow-x-auto border-t border-gray-200">
        {JSON.stringify(jsonData.data, null, 2)}
      </pre>
    ) : null}
  </div>
);

// Component to render text content
const TextContent = ({ text }: { text: string }) => (
  <div className="markdown-content">
    <Markdown options={markdownOptions}>{text}</Markdown>
  </div>
);

// Component to render multiple JSON tool responses
const MultipleJsonToolResponses = ({
  jsonDataList,
}: {
  jsonDataList: JsonToolResponseType[];
}) => (
  <div className="space-y-2">
    {jsonDataList.map((jsonData, index) => (
      <JsonToolResponse key={index} jsonData={jsonData} />
    ))}
  </div>
);

export function MessageContent({ message }: { message: Message }): ReactNode {
  // Handle string content
  if (typeof message.content === "string") {
    const trimmedContent = message.content.trim();

    // Check if the content is a JSON array of tool responses
    if (trimmedContent.startsWith("[") && trimmedContent.endsWith("]")) {
      const jsonResponses = parseJsonArray(trimmedContent);
      if (jsonResponses.length > 0) {
        return <MultipleJsonToolResponses jsonDataList={jsonResponses} />;
      }
    }

    // Check if the content contains JSON tool responses
    if (containsMultipleJsonObjects(trimmedContent)) {
      const jsonResponses = extractJsonObjects(trimmedContent);
      if (jsonResponses.length > 0) {
        return <MultipleJsonToolResponses jsonDataList={jsonResponses} />;
      }
    }

    // Render as regular text if not a tool response
    return <TextContent text={message.content} />;
  }

  // Handle array content
  return (
    <div className="space-y-4">
      {message.content.map((item: ContentItem, idx: number) => {
        if (item.type === "text") {
          return <TextContent key={idx} text={item.text} />;
        } else if (item.type === "tool-call") {
          return (
            <ToolCallContent
              key={idx}
              toolName={item.toolName}
              args={item.args}
            />
          );
        } else if (item.type === "tool-result") {
          return (
            <ToolResultContent
              key={idx}
              toolName={item.toolName}
              result={item.result}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
