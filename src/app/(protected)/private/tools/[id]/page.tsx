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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CustomToolFormData,
  getCustomToolWithImplementation,
  updateCustomTool,
} from "@/lib/actions/customTools";
import { handleSchemaChange, safeStringifyJson } from "@/utils/json";
import { createClient } from "@/utils/supabase/client";
import { Json } from "@/utils/supabase/database.types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

export default function EditToolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isAsync, setIsAsync] = useState(false);
  const [inputSchema, setInputSchema] = useState<Json>({});
  const [executeCode, setExecuteCode] = useState("");
  const [syncToolCode, setSyncToolCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  // Fetch tool data on component mount
  useEffect(() => {
    async function fetchToolData() {
      try {
        const toolData = await getCustomToolWithImplementation(id, supabase);
        if (toolData) {
          setName(toolData.tool.name);
          setDescription(toolData.tool.description);
          setIsAsync(toolData.tool.is_async);
          setInputSchema(toolData.tool.input_schema);
          setExecuteCode(toolData.implementation.execute_code);
          setSyncToolCode(toolData.implementation.sync_tool_code || "");
        }
      } catch (error) {
        console.error("Error fetching tool data:", error);
        setError("Failed to load tool data");
      } finally {
        setLoading(false);
      }
    }

    fetchToolData();
  }, [id, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate form
      if (!name) throw new Error("Tool name is required");
      if (!description) throw new Error("Description is required");
      if (!executeCode) throw new Error("Execute code is required");

      let parsedSchema: Json;
      try {
        // Make sure schema is valid JSON if it's a string - improve handling
        parsedSchema =
          typeof inputSchema === "string"
            ? handleSchemaChange(inputSchema)
            : inputSchema;

        // Make sure we have a valid object before submitting
        if (typeof parsedSchema === "string") {
          throw new Error("Input schema must be valid JSON");
        }
      } catch {
        throw new Error("Input schema must be valid JSON");
      }

      const formData: CustomToolFormData = {
        name,
        description,
        input_schema: parsedSchema,
        execute_code: executeCode,
        sync_tool_code: syncToolCode || null,
        is_async: isAsync,
      };

      // Update the tool
      await updateCustomTool(id, formData, supabase);

      // Redirect to the tools list
      router.push("/private/tools");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading tool data...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" asChild className="mr-2">
          <Link href="/private/tools">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Edit Tool</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Tool Information</CardTitle>
              <CardDescription>
                Basic information about your custom tool
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Tool Name</Label>
                <Input
                  id="name"
                  placeholder="E.g., Weather Lookup"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Explain what this tool does..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="async"
                  checked={isAsync}
                  onCheckedChange={setIsAsync}
                />
                <Label htmlFor="async">Asynchronous Tool</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Input Schema</CardTitle>
              <CardDescription>
                Define the parameters your tool accepts using JSON Schema format
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeEditor
                value={safeStringifyJson(inputSchema)}
                onChange={(value: string) => {
                  setInputSchema(handleSchemaChange(value));
                }}
                language="json"
                height="200px"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Implementation</CardTitle>
              <CardDescription>
                Write the code that will execute when this tool is called
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="execute">
                <TabsList className="mb-4">
                  <TabsTrigger value="execute">
                    Execute Code (Required)
                  </TabsTrigger>
                  <TabsTrigger value="sync">
                    Sync Tool Code (Optional)
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="execute">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-2">
                      This code will be executed when the tool is called by an
                      agent. You have access to the input arguments and the
                      calling agent ID.
                    </p>
                    <CodeEditor
                      value={executeCode}
                      onChange={setExecuteCode}
                      language="javascript"
                      height="300px"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="sync">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-2">
                      This optional code runs synchronously during LLM
                      processing. It should be fast and simple, returning data
                      the LLM can use directly.
                    </p>
                    <CodeEditor
                      value={syncToolCode}
                      onChange={setSyncToolCode}
                      language="javascript"
                      height="300px"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {error && (
            <div className="bg-destructive/15 text-destructive p-3 rounded-md">
              {error}
            </div>
          )}

          <CardFooter className="flex justify-end space-x-4 px-0">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push("/private/tools")}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </div>
      </form>
    </div>
  );
}
