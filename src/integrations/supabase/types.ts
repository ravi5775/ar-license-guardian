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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      albums: {
        Row: {
          access_mode: string
          compiled_mind_path: string | null
          compiled_mind_url: string | null
          created_at: string
          id: string
          owner_id: string
          pin_created_at: string | null
          pin_expires_at: string | null
          pin_hash: string | null
          pin_updated_at: string | null
          project_id: string | null
          published: boolean
          show_in_gallery: boolean
          single_use_media: boolean
          slug: string
          target_count: number
          title: string
          updated_at: string
        }
        Insert: {
          access_mode?: string
          compiled_mind_path?: string | null
          compiled_mind_url?: string | null
          created_at?: string
          id?: string
          owner_id: string
          pin_created_at?: string | null
          pin_expires_at?: string | null
          pin_hash?: string | null
          pin_updated_at?: string | null
          project_id?: string | null
          published?: boolean
          show_in_gallery?: boolean
          single_use_media?: boolean
          slug: string
          target_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          access_mode?: string
          compiled_mind_path?: string | null
          compiled_mind_url?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          pin_created_at?: string | null
          pin_expires_at?: string | null
          pin_hash?: string | null
          pin_updated_at?: string | null
          project_id?: string | null
          published?: boolean
          show_in_gallery?: boolean
          single_use_media?: boolean
          slug?: string
          target_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_experiences: {
        Row: {
          access_mode: string
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
          pin_created_at: string | null
          pin_expires_at: string | null
          pin_hash: string | null
          pin_updated_at: string | null
          project_id: string | null
          published: boolean
          show_in_gallery: boolean
          single_use_media: boolean
          slug: string | null
          target_index: number | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          access_mode?: string
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
          pin_created_at?: string | null
          pin_expires_at?: string | null
          pin_hash?: string | null
          pin_updated_at?: string | null
          project_id?: string | null
          published?: boolean
          show_in_gallery?: boolean
          single_use_media?: boolean
          slug?: string | null
          target_index?: number | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          access_mode?: string
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
          pin_created_at?: string | null
          pin_expires_at?: string | null
          pin_hash?: string | null
          pin_updated_at?: string | null
          project_id?: string | null
          published?: boolean
          show_in_gallery?: boolean
          single_use_media?: boolean
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
          {
            foreignKeyName: "ar_experiences_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      content_access_tokens: {
        Row: {
          content_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          kind: string
          label: string | null
          last_used_at: string | null
          revoked_at: string | null
          slug: string
          token_hash: string
        }
        Insert: {
          content_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          slug: string
          token_hash: string
        }
        Update: {
          content_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          slug?: string
          token_hash?: string
        }
        Relationships: []
      }
      gate_events: {
        Row: {
          approval: string | null
          created_at: string
          decision: string
          deployment_role: string
          id: string
          is_admin: boolean
          meta: Json
          path: string
          reason: string
          user_id: string | null
        }
        Insert: {
          approval?: string | null
          created_at?: string
          decision: string
          deployment_role?: string
          id?: string
          is_admin?: boolean
          meta?: Json
          path: string
          reason: string
          user_id?: string | null
        }
        Update: {
          approval?: string | null
          created_at?: string
          decision?: string
          deployment_role?: string
          id?: string
          is_admin?: boolean
          meta?: Json
          path?: string
          reason?: string
          user_id?: string | null
        }
        Relationships: []
      }
      license_activations: {
        Row: {
          activated_at: string
          asset_digest: string | null
          build_id: string | null
          capability_tier: string | null
          customer_id: string | null
          deployment_domain: string | null
          deployment_platform: string | null
          device_class: string
          device_secret_hash: string | null
          fingerprint: string
          id: string
          ip_address: string | null
          label: string | null
          last_seen_at: string
          license_id: string
          origin_host: string | null
          release_after: string | null
          release_hash: string | null
          released_at: string | null
          revoked_at: string | null
          supabase_ref: string | null
          user_agent: string | null
        }
        Insert: {
          activated_at?: string
          asset_digest?: string | null
          build_id?: string | null
          capability_tier?: string | null
          customer_id?: string | null
          deployment_domain?: string | null
          deployment_platform?: string | null
          device_class?: string
          device_secret_hash?: string | null
          fingerprint: string
          id?: string
          ip_address?: string | null
          label?: string | null
          last_seen_at?: string
          license_id: string
          origin_host?: string | null
          release_after?: string | null
          release_hash?: string | null
          released_at?: string | null
          revoked_at?: string | null
          supabase_ref?: string | null
          user_agent?: string | null
        }
        Update: {
          activated_at?: string
          asset_digest?: string | null
          build_id?: string | null
          capability_tier?: string | null
          customer_id?: string | null
          deployment_domain?: string | null
          deployment_platform?: string | null
          device_class?: string
          device_secret_hash?: string | null
          fingerprint?: string
          id?: string
          ip_address?: string | null
          label?: string | null
          last_seen_at?: string
          license_id?: string
          origin_host?: string | null
          release_after?: string | null
          release_hash?: string | null
          released_at?: string | null
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
      license_violations: {
        Row: {
          created_at: string
          detail: Json
          fingerprint: string | null
          id: string
          ip_address: string | null
          kind: string
          license_id: string | null
          license_key: string | null
          notified_at: string | null
          origin_host: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          fingerprint?: string | null
          id?: string
          ip_address?: string | null
          kind: string
          license_id?: string | null
          license_key?: string | null
          notified_at?: string | null
          origin_host?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Update: {
          created_at?: string
          detail?: Json
          fingerprint?: string | null
          id?: string
          ip_address?: string | null
          kind?: string
          license_id?: string | null
          license_key?: string | null
          notified_at?: string | null
          origin_host?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_violations_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          allowed_desktop: number
          allowed_mobile: number
          allowed_origins: string[]
          auto_issued: boolean
          client_email: string
          client_name: string
          created_at: string
          customer_id: string | null
          expires_at: string | null
          grace_hours: number
          id: string
          issued_at: string
          license_key: string
          max_activations: number
          notes: string | null
          owner_user_id: string | null
          plan: Database["public"]["Enums"]["license_plan"]
          status: Database["public"]["Enums"]["license_status"]
          updated_at: string
        }
        Insert: {
          allowed_desktop?: number
          allowed_mobile?: number
          allowed_origins?: string[]
          auto_issued?: boolean
          client_email: string
          client_name: string
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          grace_hours?: number
          id?: string
          issued_at?: string
          license_key: string
          max_activations?: number
          notes?: string | null
          owner_user_id?: string | null
          plan?: Database["public"]["Enums"]["license_plan"]
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
        }
        Update: {
          allowed_desktop?: number
          allowed_mobile?: number
          allowed_origins?: string[]
          auto_issued?: boolean
          client_email?: string
          client_name?: string
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          grace_hours?: number
          id?: string
          issued_at?: string
          license_key?: string
          max_activations?: number
          notes?: string | null
          owner_user_id?: string | null
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
      media_access_nonces: {
        Row: {
          consumed_at: string | null
          content_slug: string
          created_at: string
          expires_at: string
          id: string
          kind: string
          nonce_hash: string
          storage_path: string
        }
        Insert: {
          consumed_at?: string | null
          content_slug: string
          created_at?: string
          expires_at: string
          id?: string
          kind: string
          nonce_hash: string
          storage_path: string
        }
        Update: {
          consumed_at?: string | null
          content_slug?: string
          created_at?: string
          expires_at?: string
          id?: string
          kind?: string
          nonce_hash?: string
          storage_path?: string
        }
        Relationships: []
      }
      media_objects: {
        Row: {
          bytes: number
          created_at: string
          id: string
          owner_id: string
          storage_path: string
        }
        Insert: {
          bytes?: number
          created_at?: string
          id?: string
          owner_id: string
          storage_path: string
        }
        Update: {
          bytes?: number
          created_at?: string
          id?: string
          owner_id?: string
          storage_path?: string
        }
        Relationships: []
      }
      media_signing_events: {
        Row: {
          content_slug: string
          created_at: string
          id: number
          ip: string | null
          kind: string
          single_use: boolean
          storage_path: string
        }
        Insert: {
          content_slug: string
          created_at?: string
          id?: number
          ip?: string | null
          kind: string
          single_use?: boolean
          storage_path: string
        }
        Update: {
          content_slug?: string
          created_at?: string
          id?: number
          ip?: string | null
          kind?: string
          single_use?: boolean
          storage_path?: string
        }
        Relationships: []
      }
      pin_failed_attempts: {
        Row: {
          created_at: string
          id: number
          ip: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: number
          ip: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: number
          ip?: string
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_decided_at: string | null
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_by: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          rejection_reason: string | null
          storage_alert_sent_at: string | null
          storage_quota_bytes: number
          updated_at: string
        }
        Insert: {
          approval_decided_at?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          rejection_reason?: string | null
          storage_alert_sent_at?: string | null
          storage_quota_bytes?: number
          updated_at?: string
        }
        Update: {
          approval_decided_at?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          rejection_reason?: string | null
          storage_alert_sent_at?: string | null
          storage_quota_bytes?: number
          updated_at?: string
        }
        Relationships: []
      }
      project_usage: {
        Row: {
          created_at: string
          egress_bytes: number
          egress_cap_bytes: number
          id: string
          month_year: string
          project_id: string | null
          request_count: number
          updated_at: string
          warning_80_notified_at: string | null
        }
        Insert: {
          created_at?: string
          egress_bytes?: number
          egress_cap_bytes?: number
          id?: string
          month_year: string
          project_id?: string | null
          request_count?: number
          updated_at?: string
          warning_80_notified_at?: string | null
        }
        Update: {
          created_at?: string
          egress_bytes?: number
          egress_cap_bytes?: number
          id?: string
          month_year?: string
          project_id?: string | null
          request_count?: number
          updated_at?: string
          warning_80_notified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
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
      release_manifests: {
        Row: {
          asset_digest: string
          branch: string
          build_id: string
          created_at: string
          customer_id: string | null
          files: Json | null
          id: string
          mismatch_count: number
          published_at: string
          signature: string
          updated_at: string
        }
        Insert: {
          asset_digest: string
          branch?: string
          build_id: string
          created_at?: string
          customer_id?: string | null
          files?: Json | null
          id?: string
          mismatch_count?: number
          published_at?: string
          signature: string
          updated_at?: string
        }
        Update: {
          asset_digest?: string
          branch?: string
          build_id?: string
          created_at?: string
          customer_id?: string | null
          files?: Json | null
          id?: string
          mismatch_count?: number
          published_at?: string
          signature?: string
          updated_at?: string
        }
        Relationships: []
      }
      revoked_builds: {
        Row: {
          build_id: string
          notes: string | null
          reason: string
          revoked_at: string
          revoked_by: string | null
        }
        Insert: {
          build_id: string
          notes?: string | null
          reason: string
          revoked_at?: string
          revoked_by?: string | null
        }
        Update: {
          build_id?: string
          notes?: string | null
          reason?: string
          revoked_at?: string
          revoked_by?: string | null
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
      consume_media_nonce: {
        Args: { _nonce_hash: string }
        Returns: {
          storage_path: string
        }[]
      }
      generate_content_pin: { Args: { _length?: number }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      issue_content_access_token: {
        Args: {
          _content_id: string
          _kind: string
          _label?: string
          _ttl_days?: number
        }
        Returns: string
      }
      pin_attempts_allowed: {
        Args: { _ip: string; _slug: string }
        Returns: boolean
      }
      pin_cleanup_old_failures: { Args: never; Returns: number }
      pin_clear_failures: {
        Args: { _ip: string; _slug: string }
        Returns: undefined
      }
      pin_record_failure: {
        Args: { _ip: string; _slug: string }
        Returns: undefined
      }
      revoke_content_access_tokens: {
        Args: { _content_id: string; _kind: string }
        Returns: number
      }
      set_content_pin: {
        Args: { _id: string; _kind: string; _pin: string; _ttl_days?: number }
        Returns: string
      }
      storage_usage: {
        Args: { _owner: string }
        Returns: {
          quota_bytes: number
          used_bytes: number
        }[]
      }
      verify_content_access_token: {
        Args: { _kind: string; _slug: string; _token: string }
        Returns: string
      }
      verify_content_pin: {
        Args: { _kind: string; _pin: string; _slug: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
      approval_status: "pending" | "approved" | "rejected"
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
      approval_status: ["pending", "approved", "rejected"],
      license_plan: ["starter", "pro", "enterprise"],
      license_status: ["active", "suspended", "revoked", "expired"],
    },
  },
} as const
