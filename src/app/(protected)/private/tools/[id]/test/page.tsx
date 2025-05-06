"use client";

import CodeEditor from "@/components/CodeEditor";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CustomToolWithImplementation,
  getCustomToolWithImplementation,
} from "@/lib/actions/customTools";
import { safeParseJson, safeStringifyJson } from "@/utils/json";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function TestToolPage({ params }: { params: { id: string } }) {
  const [toolData, setToolData] = useState<CustomToolWithImplementation | null>(
    null
  );
  const [inputArgs, setInputArgs] = useState<string>("{}");
  const [outputResult, setOutputResult] = useState<string>("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  // Fetch tool data on component mount
  useEffect(() => {
    async function fetchToolData() {
      try {
        const data = await getCustomToolWithImplementation(params.id, supabase);
        setToolData(data);

        // Initialize input args with example values from schema
        if (data?.tool.input_schema) {
          try {
            const schema = data.tool.input_schema as Record<string, unknown>;
            const defaultValues: Record<string, unknown> = {};

            if (schema.properties) {
              Object.entries(schema.properties).forEach(
                ([key, prop]: [string, unknown]) => {
                  // Set example values based on type
                  const typedProp = prop as { type: string; example?: unknown };

                  // Set example values based on type
                  switch (typedProp.type) {
                    case "string":
                      defaultValues[key] =
                        typedProp.example || "example string";
                      break;
                    case "number":
                      defaultValues[key] = typedProp.example || 42;
                      break;
                    case "boolean":
                      defaultValues[key] = typedProp.example || false;
                      break;
                    case "object":
                      defaultValues[key] = typedProp.example || {};
                      break;
                    case "array":
                      defaultValues[key] = typedProp.example || [];
                      break;
                    default:
                      defaultValues[key] = null;
                  }
                }
              );
            }

            setInputArgs(safeStringifyJson(defaultValues));
          } catch (err) {
            console.error("Error parsing schema:", err);
          }
        }
      } catch (error) {
        console.error("Error fetching tool data:", error);
        setError("Failed to load tool data");
      } finally {
        setLoading(false);
      }
    }

    fetchToolData();
  }, [params.id]);

  const handleExecute = async () => {
    setIsExecuting(true);
    setError(null);
    setOutputResult("");

    try {
      // Parse input arguments
      const args = safeParseJson(inputArgs, {});

      // Execute the tool
      const response = await fetch(`/api/custom-tools/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool_id: params.id,
          args,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to execute tool");
      }

      // Display the result
      setOutputResult(safeStringifyJson(result.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setOutputResult("");
    } finally {
      setIsExecuting(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading tool data...</div>;
  }

  if (!toolData) {
    return (
      <div className="p-4">
        <div className="bg-destructive/15 text-destructive p-3 rounded-md">
          Tool not found or you don&apos;t have permission to access it.
        </div>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/private/tools")}
        >
          Back to Tools
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" asChild className="mr-2">
          <Link href="/private/tools">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Test Tool: {toolData.tool.name}</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>
              Provide arguments for the tool in JSON format
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeEditor
              value={inputArgs}
              onChange={setInputArgs}
              language="json"
              height="300px"
            />
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleExecute}
              disabled={isExecuting}
              className="w-full"
            >
              {isExecuting ? "Executing..." : "Execute Tool"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Output</CardTitle>
            <CardDescription>Results from tool execution</CardDescription>
          </CardHeader>
          <CardContent className="min-h-[300px]">
            {error ? (
              <div className="bg-destructive/15 text-destructive p-3 rounded-md">
                {error}
              </div>
            ) : outputResult ? (
              <CodeEditor
                value={outputResult}
                onChange={() => {}}
                language="json"
                height="300px"
              />
            ) : (
              <div className="text-muted-foreground p-4 h-full flex items-center justify-center">
                <p>Execute the tool to see results here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Tool Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Description</h3>
              <p className="text-muted-foreground">
                {toolData.tool.description}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-medium">Input Schema</h3>
              <CodeEditor
                value={safeStringifyJson(toolData.tool.input_schema)}
                onChange={() => {}}
                language="json"
                height="150px"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
