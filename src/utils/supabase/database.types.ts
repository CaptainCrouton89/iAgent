export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agents: {
        Row: {
          agent_type: string
          background: string | null
          boss_id: string | null
          created_at: string | null
          cwd: string | null
          goal: string
          id: string
          is_active: boolean | null
          logs: string | null
          owner: string
          title: string
          updated_at: string | null
        }
        Insert: {
          agent_type: string
          background?: string | null
          boss_id?: string | null
          created_at?: string | null
          cwd?: string | null
          goal: string
          id?: string
          is_active?: boolean | null
          logs?: string | null
          owner: string
          title: string
          updated_at?: string | null
        }
        Update: {
          agent_type?: string
          background?: string | null
          boss_id?: string | null
          created_at?: string | null
          cwd?: string | null
          goal?: string
          id?: string
          is_active?: boolean | null
          logs?: string | null
          owner?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_boss_id_fkey"
            columns: ["boss_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_settings: {
        Row: {
          auth_id: string | null
          created_at: string
          id: number
          interaction_lessons: Json
        }
        Insert: {
          auth_id?: string | null
          created_at?: string
          id?: number
          interaction_lessons?: Json
        }
        Update: {
          auth_id?: string | null
          created_at?: string
          id?: number
          interaction_lessons?: Json
        }
        Relationships: []
      }
      clusters: {
        Row: {
          auth_id: string
          created_at: string
          embedding: string | null
          id: string
          parent: string | null
          summary: string
        }
        Insert: {
          auth_id?: string
          created_at?: string
          embedding?: string | null
          id?: string
          parent?: string | null
          summary?: string
        }
        Update: {
          auth_id?: string
          created_at?: string
          embedding?: string | null
          id?: string
          parent?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "clusters_parent_fkey"
            columns: ["parent"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      contexts: {
        Row: {
          created_at: string | null
          id: string
          owner: string
          text_data: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          owner: string
          text_data?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          owner?: string
          text_data?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      memories: {
        Row: {
          auth_id: string
          compressed_conversation: Json
          content: Json
          context: string | null
          created_at: string
          embedding: string | null
          id: string
          summary: string
          title: string
        }
        Insert: {
          auth_id?: string
          compressed_conversation?: Json
          content?: Json
          context?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          summary?: string
          title?: string
        }
        Update: {
          auth_id?: string
          compressed_conversation?: Json
          content?: Json
          context?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          summary?: string
          title?: string
        }
        Relationships: []
      }
      memory_cluster_map: {
        Row: {
          auth_id: string
          cluster_id: string
          id: string
          memory_id: string
        }
        Insert: {
          auth_id?: string
          cluster_id?: string
          id?: string
          memory_id?: string
        }
        Update: {
          auth_id?: string
          cluster_id?: string
          id?: string
          memory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_cluster_map_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_cluster_map_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
        ]
      }
      programming_tasks: {
        Row: {
          context_id: string | null
          created_at: string | null
          description: string
          id: string
          owner: string | null
          task_id: string
          updated_at: string | null
        }
        Insert: {
          context_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          owner?: string | null
          task_id: string
          updated_at?: string | null
        }
        Update: {
          context_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          owner?: string | null
          task_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programming_tasks_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programming_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          complexity: number
          context_id: string
          created_at: string | null
          description: string
          id: string
          is_cursor: boolean | null
          logs: string | null
          owner: string | null
          owner_id: string | null
          parent_id: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          complexity?: number
          context_id: string
          created_at?: string | null
          description: string
          id?: string
          is_cursor?: boolean | null
          logs?: string | null
          owner?: string | null
          owner_id?: string | null
          parent_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          complexity?: number
          context_id?: string
          created_at?: string | null
          description?: string
          id?: string
          is_cursor?: boolean | null
          logs?: string | null
          owner?: string | null
          owner_id?: string | null
          parent_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      create_contacts_table: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      delete_old_memories: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      match_memories: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          content: string
          source: string
          source_id: string
          relevance_score: number
          created_at: string
          similarity: number
        }[]
      }
      search_memories: {
        Args: {
          query_embedding: string
          match_threshold?: number
          match_count?: number
        }
        Returns: {
          id: string
          content: Json
          compressed_conversation: Json
          context: string
          created_at: string
          similarity: number
        }[]
      }
      search_memories_by_date: {
        Args: {
          query_embedding: string
          match_threshold?: number
          match_count?: number
          start_date?: string
          end_date?: string
        }
        Returns: {
          id: string
          content: Json
          compressed_conversation: Json
          context: string
          created_at: string
          similarity: number
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
