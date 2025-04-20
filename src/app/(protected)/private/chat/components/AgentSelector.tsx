"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAgents, type Agent } from "@/lib/actions/agents";
import { createClient } from "@/utils/supabase/client";
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

  useEffect(() => {
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

    fetchAgents();
  }, []);

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
    <Select value={selectedAgentId} onValueChange={onAgentChange}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Select an agent" />
      </SelectTrigger>
      <SelectContent>
        {agents.map((agent) => (
          <SelectItem key={agent.id} value={agent.id}>
            {agent.title} ({agent.agent_type})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
