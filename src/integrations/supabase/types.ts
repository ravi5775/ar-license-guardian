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
      albums: {
        Row: {
          compiled_mind_path: string | null
          compiled_mind_url: string | null
          created_at: string
          id: string
          owner_id: string
          published: boolean
          slug: string
          target_count: number
          title: string
          updated_at: string
        }
        Insert: {
          compiled_mind_path?: string | null
          compiled_mind_url?: string | null
          created_at?: string
          id?: string
          owner_id: string
          published?: boolean
          slug: string
          target_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          compiled_mind_path?: string | null
          compiled_mind_url?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          published?: boolean
          slug?: string
          target_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ar_experiences: {
        Row: {
          album_id: string | null
          autoplay: boolean
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          loop_playback: boolean
          marker_mind_path: string | null
          marker_path: string | null
          marker_url: string | null
          media_path: string | null
          media_type: string
          media_url: string | null
          owner_id: string
          published: boolean
          slug: string | null
          target_index: number | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          album_id?: string | null
          autoplay?: boolean
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          loop_playback?: boolean
          marker_mind_path?: string | null
          marker_path?: string | null
          marker_url?: string | null
          media_path?: string | null
          media_type?: string
          media_url?: string | null
          owner_id: string
          published?: boolean
          slug?: string | null
          target_index?: number | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          album_id?: string | null
          autoplay?: boolean
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          loop_playback?: boolean
          marker_mind_path?: string | null
          marker_path?: string | null
          marker_url?: string | null
          media_path?: string | null
          media_type?: string
          media_url?: string | null
          owner_id?: string
          published?: boolean
          slug?: string | null
          target_index?: number | null
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ar_experiences_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          ip_address: string | null
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: number
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: number
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      license_activations: {
        Row: {
          activated_at: string
          deployment_domain: string | null
          deployment_platform: string | null
          fingerprint: string
          id: string
          ip_address: string | null
          last_seen_at: string
          license_id: string
          revoked_at: string | null
          supabase_ref: string | null
          user_agent: string | null
        }
        Insert: {
          activated_at?: string
          deployment_domain?: string | null
          deployment_platform?: string | null
          fingerprint: string
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          license_id: string
          revoked_at?: string | null
          supabase_ref?: string | null
          user_agent?: string | null
        }
        Update: {
          activated_at?: string
          deployment_domain?: string | null
          deployment_platform?: string | null
          fingerprint?: string
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          license_id?: string
          revoked_at?: string | null
          supabase_ref?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "license_activations_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          client_email: string
          client_name: string
          created_at: string
          expires_at: string | null
          id: string
          issued_at: string
          license_key: string
          max_activations: number
          notes: string | null
          plan: Database["public"]["Enums"]["license_plan"]
          status: Database["public"]["Enums"]["license_status"]
          updated_at: string
        }
        Insert: {
          client_email: string
          client_name: string
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          license_key: string
          max_activations?: number
          notes?: string | null
          plan?: Database["public"]["Enums"]["license_plan"]
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
        }
        Update: {
          client_email?: string
          client_name?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          license_key?: string
          max_activations?: number
          notes?: string | null
          plan?: Database["public"]["Enums"]["license_plan"]
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
        }
        Relationships: []
      }
      marker_tests: {
        Row: {
          album_id: string | null
          angle_deg: number | null
          created_at: string
          device: string | null
          distance_cm: number | null
          experience_id: string | null
          id: string
          lighting: string
          marker_label: string
          notes: string | null
          outcome: string
          owner_id: string
          step_key: string
          time_to_detect_ms: number | null
          updated_at: string
        }
        Insert: {
          album_id?: string | null
          angle_deg?: number | null
          created_at?: string
          device?: string | null
          distance_cm?: number | null
          experience_id?: string | null
          id?: string
          lighting: string
          marker_label: string
          notes?: string | null
          outcome: string
          owner_id: string
          step_key: string
          time_to_detect_ms?: number | null
          updated_at?: string
        }
        Update: {
          album_id?: string | null
          angle_deg?: number | null
          created_at?: string
          device?: string | null
          distance_cm?: number | null
          experience_id?: string | null
          id?: string
          lighting?: string
          marker_label?: string
          notes?: string | null
          outcome?: string
          owner_id?: string
          step_key?: string
          time_to_detect_ms?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marker_tests_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marker_tests_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "ar_experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_hits: {
        Row: {
          bucket: string
          hit_at: string
          id: number
          key: string
        }
        Insert: {
          bucket: string
          hit_at?: string
          id?: number
          key: string
        }
        Update: {
          bucket?: string
          hit_at?: string
          id?: number
          key?: string
        }
        Relationships: []
      }
      scan_events: {
        Row: {
          album_id: string | null
          created_at: string
          duration_ms: number | null
          event_type: string
          experience_id: string | null
          id: string
          session_id: string
          target_index: number | null
        }
        Insert: {
          album_id?: string | null
          created_at?: string
          duration_ms?: number | null
          event_type: string
          experience_id?: string | null
          id?: string
          session_id: string
          target_index?: number | null
        }
        Update: {
          album_id?: string | null
          created_at?: string
          duration_ms?: number | null
          event_type?: string
          experience_id?: string | null
          id?: string
          session_id?: string
          target_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_events_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_events_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "ar_experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_record_hit: {
        Args: {
          _bucket: string
          _key: string
          _max: number
          _window_seconds: number
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
      license_plan: "starter" | "pro" | "enterprise"
      license_status: "active" | "suspended" | "revoked" | "expired"
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
    Enums: {
      app_role: ["admin", "editor", "viewer"],
      license_plan: ["starter", "pro", "enterprise"],
      license_status: ["active", "suspended", "revoked", "expired"],
    },
  },
} as const
