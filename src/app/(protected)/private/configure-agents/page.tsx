"use client";

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
import { Textarea } from "@/components/ui/textarea";
import { Tables } from "@/utils/supabase/database.types";
import { ArrowLeft, Edit, Save, Trash, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Agent = Tables<"agents">;

export default function ConfigureAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/agents");

      if (!response.ok) {
        throw new Error("Failed to fetch agents");
      }

      const data = await response.json();
      setAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch agents");
      console.error("Error fetching agents:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent({ ...agent });
  };

  const handleCancelEdit = () => {
    setEditingAgent(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (!editingAgent) return;

    const { name, value } = e.target;
    setEditingAgent((prev: Agent | null) => {
      if (!prev) return null;
      return { ...prev, [name]: value };
    });
  };

  const handleToggleChange = (name: string, checked: boolean) => {
    if (!editingAgent) return;

    setEditingAgent((prev: Agent | null) => {
      if (!prev) return null;
      return { ...prev, [name]: checked };
    });
  };

  const handleSaveAgent = async () => {
    if (!editingAgent) return;

    try {
      const response = await fetch(`/api/agents/${editingAgent.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editingAgent),
      });

      if (!response.ok) {
        throw new Error("Failed to update agent");
      }

      // Refresh the agent list
      await fetchAgents();
      setEditingAgent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update agent");
      console.error("Error updating agent:", err);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this agent?")) return;

    try {
      const response = await fetch(`/api/agents/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete agent");
      }

      // Refresh the agent list
      await fetchAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete agent");
      console.error("Error deleting agent:", err);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center mb-6">
        <Link href="/private/chat">
          <Button variant="outline" size="sm" className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Chat
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Configure Agents</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-md mb-6">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p>Loading agents...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <Card key={agent.id} className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex justify-between items-start">
                  <span>{agent.title}</span>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditAgent(agent)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAgent(agent.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>Type: {agent.agent_type}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="font-medium">Goal:</span>
                  <p className="text-gray-600 text-sm">{agent.goal}</p>
                </div>
                {agent.background && (
                  <div>
                    <span className="font-medium">Background:</span>
                    <p className="text-gray-600 text-sm">{agent.background}</p>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Active:</span>
                  <span
                    className={
                      agent.is_active ? "text-green-500" : "text-red-500"
                    }
                  >
                    {agent.is_active ? "Yes" : "No"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Agent Modal */}
      {editingAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Edit Agent: {editingAgent.title}</span>
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                  <X className="h-5 w-5" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  value={editingAgent.title}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent_type">Agent Type</Label>
                <Input
                  id="agent_type"
                  name="agent_type"
                  value={editingAgent.agent_type}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal">Goal</Label>
                <Textarea
                  id="goal"
                  name="goal"
                  rows={3}
                  value={editingAgent.goal}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="background">Background</Label>
                <Textarea
                  id="background"
                  name="background"
                  rows={5}
                  value={editingAgent.background || ""}
                  onChange={handleInputChange}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Label htmlFor="is_active">Active</Label>
                <Switch
                  id="is_active"
                  checked={editingAgent.is_active || false}
                  onCheckedChange={(checked: boolean) =>
                    handleToggleChange("is_active", checked)
                  }
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button onClick={handleSaveAgent}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
