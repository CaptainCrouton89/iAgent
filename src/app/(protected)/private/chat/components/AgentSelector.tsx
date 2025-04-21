"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAgents, type Agent } from "@/lib/actions/agents";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface AgentSelectorProps {
  selectedAgentId: string;
  onAgentChange: (agentId: string) => void;
}

export function AgentSelector({
  selectedAgentId,
  onAgentChange,
}: AgentSelectorProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null);
  const router = useRouter();

  const fetchAgents = async () => {
    try {
      const supabase = createClient();
      const agentList = await getAgents(supabase);
      setAgents(agentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch agents");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleDeleteAgent = async (agentId: string) => {
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/agents/delete?agentId=${agentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete agent");
      }

      // If the deleted agent was selected, clear the selection
      if (selectedAgentId === agentId) {
        onAgentChange("");
      }

      // Refresh the agents list
      await fetchAgents();

      // Refresh the page to update UI
      router.refresh();
    } catch (error) {
      console.error("Error deleting agent:", error);
      setError(
        error instanceof Error ? error.message : "Failed to delete agent"
      );
    } finally {
      setIsDeleting(false);
      setAgentToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="w-[220px] h-10 animate-pulse bg-gray-200 rounded-md"></div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-sm">Error: {error}</div>;
  }

  if (agents.length === 0) {
    return (
      <div className="text-yellow-600 text-sm px-3 py-2 bg-yellow-50 rounded-md">
        No agents available
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedAgentId} onValueChange={onAgentChange}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Select an agent" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {agents.map((agent) => (
              <SelectItem
                key={agent.id}
                value={agent.id}
                className="flex justify-between items-center pr-8"
              >
                <span>
                  {agent.title} ({agent.agent_type})
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {selectedAgentId && (
        <AlertDialog
          open={agentToDelete === selectedAgentId}
          onOpenChange={(open) => !open && setAgentToDelete(null)}
        >
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setAgentToDelete(selectedAgentId)}
              disabled={isDeleting}
              className="h-10 w-10 text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Agent</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this agent? This action cannot
                be undone. All agent data, including messages and tasks, will be
                permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => handleDeleteAgent(selectedAgentId)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
