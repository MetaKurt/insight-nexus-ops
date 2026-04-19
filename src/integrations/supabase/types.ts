export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      contacts: {
        Row: {
          confidence: number | null
          created_at: string
          email: string | null
          email_score: number | null
          email_verification_status: string | null
          enriched_at: string | null
          enrichment_provider: string | null
          enrichment_sources: Json | null
          finding_id: string | null
          id: string
          linkedin_url: string | null
          name: string | null
          notes: string | null
          organization: string | null
          outreach_status: string | null
          phone: string | null
          project_id: string | null
          role_title: string | null
          social_url: string | null
          source: string | null
          twitter_url: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          email?: string | null
          email_score?: number | null
          email_verification_status?: string | null
          enriched_at?: string | null
          enrichment_provider?: string | null
          enrichment_sources?: Json | null
          finding_id?: string | null
          id?: string
          linkedin_url?: string | null
          name?: string | null
          notes?: string | null
          organization?: string | null
          outreach_status?: string | null
          phone?: string | null
          project_id?: string | null
          role_title?: string | null
          social_url?: string | null
          source?: string | null
          twitter_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          email?: string | null
          email_score?: number | null
          email_verification_status?: string | null
          enriched_at?: string | null
          enrichment_provider?: string | null
          enrichment_sources?: Json | null
          finding_id?: string | null
          id?: string
          linkedin_url?: string | null
          name?: string | null
          notes?: string | null
          organization?: string | null
          outreach_status?: string | null
          phone?: string | null
          project_id?: string | null
          role_title?: string | null
          social_url?: string | null
          source?: string | null
          twitter_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          confidence: number | null
          created_at: string
          data: Json
          id: string
          project_id: string | null
          run_id: string | null
          source_type: string | null
          source_url: string | null
          status: string | null
          summary: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          data?: Json
          id?: string
          project_id?: string | null
          run_id?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          data?: Json
          id?: string
          project_id?: string | null
          run_id?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "findings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_logs: {
        Row: {
          created_at: string
          id: number
          job_id: string
          level: string
          message: string
          worker_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          job_id: string
          level?: string
          message: string
          worker_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          job_id?: string
          level?: string
          message?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_logs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          errors_count: number
          id: string
          job_type: string
          notes: string | null
          payload: Json
          priority: number
          project_id: string | null
          records_created: number
          requested_by: string | null
          started_at: string | null
          status: string
          worker_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          errors_count?: number
          id?: string
          job_type: string
          notes?: string | null
          payload?: Json
          priority?: number
          project_id?: string | null
          records_created?: number
          requested_by?: string | null
          started_at?: string | null
          status?: string
          worker_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          errors_count?: number
          id?: string
          job_type?: string
          notes?: string | null
          payload?: Json
          priority?: number
          project_id?: string | null
          records_created?: number
          requested_by?: string | null
          started_at?: string | null
          status?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_stages: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          depends_on_stage_id: string | null
          description: string | null
          id: string
          job_id: string | null
          job_type: string
          mission_id: string
          name: string
          order_index: number
          payload: Json
          requires_review: boolean
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          depends_on_stage_id?: string | null
          description?: string | null
          id?: string
          job_id?: string | null
          job_type: string
          mission_id: string
          name: string
          order_index: number
          payload?: Json
          requires_review?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          depends_on_stage_id?: string | null
          description?: string | null
          id?: string
          job_id?: string | null
          job_type?: string
          mission_id?: string
          name?: string
          order_index?: number
          payload?: Json
          requires_review?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_stages_depends_on_stage_id_fkey"
            columns: ["depends_on_stage_id"]
            isOneToOne: false
            referencedRelation: "mission_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_stages_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          project_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      runs: {
        Row: {
          completed_at: string | null
          id: string
          job_id: string | null
          project_id: string | null
          run_type: string | null
          source_type: string | null
          started_at: string | null
          status: string | null
          summary: Json | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          job_id?: string | null
          project_id?: string | null
          run_type?: string | null
          source_type?: string | null
          started_at?: string | null
          status?: string | null
          summary?: Json | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          job_id?: string | null
          project_id?: string | null
          run_type?: string | null
          source_type?: string | null
          started_at?: string | null
          status?: string | null
          summary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          created_at: string
          current_job_id: string | null
          environment: string | null
          id: string
          last_heartbeat: string | null
          machine_name: string
          status: string
          updated_at: string
          version: string | null
        }
        Insert: {
          created_at?: string
          current_job_id?: string | null
          environment?: string | null
          id?: string
          last_heartbeat?: string | null
          machine_name: string
          status?: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          created_at?: string
          current_job_id?: string | null
          environment?: string | null
          id?: string
          last_heartbeat?: string | null
          machine_name?: string
          status?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_current_job_id_fkey"
            columns: ["current_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_mission_stage: {
        Args: { p_approver?: string; p_stage_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          depends_on_stage_id: string | null
          description: string | null
          id: string
          job_id: string | null
          job_type: string
          mission_id: string
          name: string
          order_index: number
          payload: Json
          requires_review: boolean
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "mission_stages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_next_job: {
        Args: { p_job_types?: string[]; p_worker_id: string }
        Returns: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          errors_count: number
          id: string
          job_type: string
          notes: string | null
          payload: Json
          priority: number
          project_id: string | null
          records_created: number
          requested_by: string | null
          started_at: string | null
          status: string
          worker_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_job: {
        Args: {
          p_errors_count?: number
          p_job_id: string
          p_notes?: string
          p_records_created?: number
          p_status: string
        }
        Returns: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          errors_count: number
          id: string
          job_type: string
          notes: string | null
          payload: Json
          priority: number
          project_id: string | null
          records_created: number
          requested_by: string | null
          started_at: string | null
          status: string
          worker_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      queue_mission_stage: {
        Args: { p_stage_id: string }
        Returns: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          errors_count: number
          id: string
          job_type: string
          notes: string | null
          payload: Json
          priority: number
          project_id: string | null
          records_created: number
          requested_by: string | null
          started_at: string | null
          status: string
          worker_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      worker_heartbeat: {
        Args: {
          p_current_job_id?: string
          p_environment?: string
          p_machine_name: string
          p_status?: string
          p_version?: string
        }
        Returns: {
          created_at: string
          current_job_id: string | null
          environment: string | null
          id: string
          last_heartbeat: string | null
          machine_name: string
          status: string
          updated_at: string
          version: string | null
        }
        SetofOptions: {
          from: "*"
          to: "workers"
          isOneToOne: true
          isSetofReturn: false
        }
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
