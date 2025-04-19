import { Tables as SupabaseTables } from "../../supabase/database.types";

// Define Json type
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Entity types
export type Agent = SupabaseTables<"agents">;
export type Context = SupabaseTables<"contexts">;
export type Task = SupabaseTables<"tasks">;
export type ProgrammingTask = SupabaseTables<"programming_tasks">;
export type Contact = SupabaseTables<"contacts">;
export type ShortTermMemory = SupabaseTables<"short_term_memory">;
export type AgentMessageHistory = SupabaseTables<"agent_message_history">;
