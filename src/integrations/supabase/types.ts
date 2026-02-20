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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      guesses: {
        Row: {
          created_at: string | null
          device_id: string
          distance_km: number
          guess_number: number
          id: string
          lat: number
          lng: number
          location_id: string
          player_name: string
        }
        Insert: {
          created_at?: string | null
          device_id: string
          distance_km: number
          guess_number?: number
          id?: string
          lat: number
          lng: number
          location_id: string
          player_name: string
        }
        Update: {
          created_at?: string | null
          device_id?: string
          distance_km?: number
          guess_number?: number
          id?: string
          lat?: number
          lng?: number
          location_id?: string
          player_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "guesses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string | null
          difficulty: number
          id: string
          is_active: boolean | null
          lat: number
          lng: number
          pano_id: string | null
        }
        Insert: {
          created_at?: string | null
          difficulty?: number
          id?: string
          is_active?: boolean | null
          lat: number
          lng: number
          pano_id?: string | null
        }
        Update: {
          created_at?: string | null
          difficulty?: number
          id?: string
          is_active?: boolean | null
          lat?: number
          lng?: number
          pano_id?: string | null
        }
        Relationships: []
      }
      polls: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closed_reason: string | null
          closed_source: string | null
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          options: Json
          poll_type: string
          question: string
          started_at: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closed_reason?: string | null
          closed_source?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
          options?: Json
          poll_type?: string
          question: string
          started_at?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closed_reason?: string | null
          closed_source?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
          options?: Json
          poll_type?: string
          question?: string
          started_at?: string | null
        }
        Relationships: []
      }
      polls_active_audit: {
        Row: {
          application_name: string | null
          audit_id: number
          auth_uid: string | null
          backend_pid: number | null
          changed_at: string
          client_addr: unknown
          db_user: string
          new_is_active: boolean | null
          old_is_active: boolean | null
          poll_id: string
          query_text: string | null
        }
        Insert: {
          application_name?: string | null
          audit_id?: number
          auth_uid?: string | null
          backend_pid?: number | null
          changed_at?: string
          client_addr?: unknown
          db_user?: string
          new_is_active?: boolean | null
          old_is_active?: boolean | null
          poll_id: string
          query_text?: string | null
        }
        Update: {
          application_name?: string | null
          audit_id?: number
          auth_uid?: string | null
          backend_pid?: number | null
          changed_at?: string
          client_addr?: unknown
          db_user?: string
          new_is_active?: boolean | null
          old_is_active?: boolean | null
          poll_id?: string
          query_text?: string | null
        }
        Relationships: []
      }
      scoring_settings: {
        Row: {
          attempt_multipliers: Json
          distance_parameter: number
          id: number
          updated_at: string
        }
        Insert: {
          attempt_multipliers?: Json
          distance_parameter?: number
          id?: number
          updated_at?: string
        }
        Update: {
          attempt_multipliers?: Json
          distance_parameter?: number
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string | null
          device_id: string
          id: string
          option_index: number
          player_name: string
          poll_id: string
        }
        Insert: {
          created_at?: string | null
          device_id: string
          id?: string
          option_index: number
          player_name: string
          poll_id: string
        }
        Update: {
          created_at?: string | null
          device_id?: string
          id?: string
          option_index?: number
          player_name?: string
          poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_queue: {
        Row: {
          channel_title: string | null
          created_at: string | null
          id: string
          is_deleted: boolean
          is_favorite: boolean
          is_playing: boolean | null
          played_at: string | null
          queued_at: string | null
          queued_by: string
          status: string
          thumbnail_url: string | null
          title: string
          video_id: string
        }
        Insert: {
          channel_title?: string | null
          created_at?: string | null
          id?: string
          is_deleted?: boolean
          is_favorite?: boolean
          is_playing?: boolean | null
          played_at?: string | null
          queued_at?: string | null
          queued_by: string
          status?: string
          thumbnail_url?: string | null
          title: string
          video_id: string
        }
        Update: {
          channel_title?: string | null
          created_at?: string | null
          id?: string
          is_deleted?: boolean
          is_favorite?: boolean
          is_playing?: boolean | null
          played_at?: string | null
          queued_at?: string | null
          queued_by?: string
          status?: string
          thumbnail_url?: string | null
          title?: string
          video_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_poll_option: {
        Args: { p_option_text: string; p_poll_id: string }
        Returns: number
      }
      close_poll: {
        Args: {
          p_closed_by?: string
          p_poll_id: string
          p_reason: string
          p_source: string
        }
        Returns: undefined
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
