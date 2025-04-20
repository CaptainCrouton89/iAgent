import { Database } from "../../supabase/database.types";
import { SupabaseService } from "./supabaseService";

// Table row types
type AgentRow = Database["public"]["Tables"]["agents"]["Row"];
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

/**
 * Agent model extended with associated tasks
 */
export interface Agent extends AgentRow {
  tasks: TaskRow[];
}

export class AgentsService {
  private supabaseService: SupabaseService;

  constructor(supabaseService?: SupabaseService) {
    this.supabaseService = supabaseService || new SupabaseService();
  }

  /**
   * Get all agents along with their associated tasks
   */
  async getAllAgents(): Promise<Agent[]> {
    const supabase = this.supabaseService.getClient();

    // Fetch agents
    const { data: agentsData, error: agentsError } = await supabase
      .from("agents")
      .select("*");
    if (agentsError) {
      console.error("Error fetching agents:", agentsError);
      throw agentsError;
    }

    const agents: AgentRow[] = agentsData || [];
    if (agents.length === 0) return [];

    // Fetch tasks for these agents
    const ids = agents.map((a) => a.id);
    const { data: tasksData, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .in("owner_id", ids);
    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
      throw tasksError;
    }

    const tasks: TaskRow[] = tasksData || [];
    const tasksMap: Record<string, TaskRow[]> = {};
    for (const task of tasks) {
      const owner = task.owner_id;
      if (!owner) continue;
      if (!tasksMap[owner]) tasksMap[owner] = [];
      tasksMap[owner].push(task);
    }

    // Combine agents with their tasks
    return agents.map((agent) => ({
      ...agent,
      tasks: tasksMap[agent.id] || [],
    }));
  }

  /**
   * Get a single agent by ID along with their tasks
   */
  async getAgentById(id: string): Promise<Agent | null> {
    const supabase = this.supabaseService.getClient();

    // Fetch agent
    const { data: agentData, error: agentError } = await supabase
      .from("agents")
      .select("*")
      .eq("id", id)
      .single();
    if (agentError) {
      // PGRST116 means no rows found
      if (agentError.code === "PGRST116") return null;
      console.error("Error fetching agent:", agentError);
      throw agentError;
    }

    const agent: AgentRow = agentData;

    // Fetch tasks for this agent
    const { data: tasksData, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .eq("owner_id", id);
    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
      throw tasksError;
    }

    const tasks: TaskRow[] = tasksData || [];
    return {
      ...agent,
      tasks,
    };
  }
}
