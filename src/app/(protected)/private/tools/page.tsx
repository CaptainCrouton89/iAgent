"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomTool, getCustomTools } from "@/lib/actions/customTools";
import { createClient } from "@/utils/supabase/client";
import { Edit, Pause, Play, PlusCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ToolsPage() {
  const [tools, setTools] = useState<CustomTool[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  // Fetch tools on component mount
  useEffect(() => {
    async function fetchTools() {
      try {
        const toolsList = await getCustomTools(supabase);
        setTools(toolsList);
      } catch (error) {
        console.error("Error fetching tools:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchTools();
  }, [supabase]);

  // Toggle tool active status
  const toggleToolStatus = async (id: string, currentStatus: boolean) => {
    try {
      // Remove from UI first for responsive feel
      setTools((prevTools) =>
        prevTools.map((tool) =>
          tool.id === id ? { ...tool, is_active: !currentStatus } : tool
        )
      );

      // API call to update status
      const response = await fetch(`/api/custom-tools/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update tool status");
      }

      router.refresh();
    } catch (error) {
      console.error("Error toggling tool status:", error);
      // Revert UI if the API call failed
      setTools((prevTools) =>
        prevTools.map((tool) =>
          tool.id === id ? { ...tool, is_active: currentStatus } : tool
        )
      );
    }
  };

  // Delete a tool
  const deleteTool = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tool?")) {
      return;
    }

    try {
      // Remove from UI first for responsive feel
      setTools((prevTools) => prevTools.filter((tool) => tool.id !== id));

      // API call to delete
      const response = await fetch(`/api/custom-tools/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete tool");
      }

      router.refresh();
    } catch (error) {
      console.error("Error deleting tool:", error);
      // Refetch tools if the API call failed
      const toolsList = await getCustomTools(supabase);
      setTools(toolsList);
    }
  };

  if (loading) {
    return <div className="p-4">Loading tools...</div>;
  }

  const activeTools = tools.filter((tool) => tool.is_active);
  const inactiveTools = tools.filter((tool) => !tool.is_active);

  return (
    <div className="container mx-auto p-4 pb-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Custom Tools</h1>
        <Button asChild>
          <Link href="/private/tools/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Tool
          </Link>
        </Button>
      </div>

      {tools.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center p-6">
              <h3 className="font-semibold text-lg mb-2">No tools found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first custom tool to extend your agents&apos;
                capabilities.
              </p>
              <Button asChild>
                <Link href="/private/tools/new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create Tool
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="active">
          <TabsList className="mb-4">
            <TabsTrigger value="active">
              Active Tools ({activeTools.length})
            </TabsTrigger>
            <TabsTrigger value="inactive">
              Inactive Tools ({inactiveTools.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeTools.map((tool) => (
                <Card key={tool.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{tool.name}</CardTitle>
                    </div>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="flex justify-between">
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => router.push(`/private/tools/${tool.id}`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          toggleToolStatus(tool.id, tool.is_active)
                        }
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => deleteTool(tool.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() =>
                        router.push(`/private/tools/${tool.id}/test`)
                      }
                    >
                      Test
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="inactive">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inactiveTools.map((tool) => (
                <Card key={tool.id} className="opacity-70">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{tool.name}</CardTitle>
                      <Badge variant="outline">Inactive</Badge>
                    </div>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="flex justify-between">
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => router.push(`/private/tools/${tool.id}`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          toggleToolStatus(tool.id, tool.is_active)
                        }
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => deleteTool(tool.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() =>
                        router.push(`/private/tools/${tool.id}/test`)
                      }
                    >
                      Test
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
