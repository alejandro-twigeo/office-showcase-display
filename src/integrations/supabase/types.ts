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
      daily_news: {
        Row: {
          created_at: string
          id: string
          items: Json
          run_date: string
          run_datetime: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          run_date: string
          run_datetime?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          run_date?: string
          run_datetime?: string | null
        }
        Relationships: []
      }
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
          round_id: string | null
        }
        Insert: {
          created_at?: string | null
          difficulty?: number
          id?: string
          is_active?: boolean | null
          lat: number
          lng: number
          pano_id?: string | null
          round_id?: string | null
        }
        Update: {
          created_at?: string | null
          difficulty?: number
          id?: string
          is_active?: boolean | null
          lat?: number
          lng?: number
          pano_id?: string | null
          round_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      plant_watering_logs: {
        Row: {
          id: string
          note: string | null
          plant_id: string
          watered_at: string
        }
        Insert: {
          id?: string
          note?: string | null
          plant_id: string
          watered_at?: string
        }
        Update: {
          id?: string
          note?: string | null
          plant_id?: string
          watered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plant_watering_logs_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      plants: {
        Row: {
          created_at: string
          id: string
          last_watered_at: string | null
          last_watered_by_device_id: string | null
          last_watered_by_name: string | null
          location: string | null
          name: string
          notes: string | null
          photo_url: string | null
          updated_at: string
          water_interval_days: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_watered_at?: string | null
          last_watered_by_device_id?: string | null
          last_watered_by_name?: string | null
          location?: string | null
          name: string
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
          water_interval_days?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_watered_at?: string | null
          last_watered_by_device_id?: string | null
          last_watered_by_name?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
          water_interval_days?: number
        }
        Relationships: []
      }
      players: {
        Row: {
          avatar: string
          created_at: string
          id: string
          name: string
          office: string
          password_text: string
          updated_at: string
        }
        Insert: {
          avatar?: string
          created_at?: string
          id?: string
          name: string
          office?: string
          password_text: string
          updated_at?: string
        }
        Update: {
          avatar?: string
          created_at?: string
          id?: string
          name?: string
          office?: string
          password_text?: string
          updated_at?: string
        }
        Relationships: []
      }
      playlist_items: {
        Row: {
          added_by: string
          channel_title: string | null
          created_at: string
          id: string
          playlist_id: string
          position: number
          thumbnail_url: string | null
          title: string
          video_id: string
        }
        Insert: {
          added_by: string
          channel_title?: string | null
          created_at?: string
          id?: string
          playlist_id: string
          position?: number
          thumbnail_url?: string | null
          title: string
          video_id: string
        }
        Update: {
          added_by?: string
          channel_title?: string | null
          created_at?: string
          id?: string
          playlist_id?: string
          position?: number
          thumbnail_url?: string | null
          title?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
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
      positive_messages: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          message: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          message: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          message?: string
          updated_at?: string
        }
        Relationships: []
      }
      round_schedule: {
        Row: {
          enabled: boolean
          id: number
          last_auto_reset_at: string | null
          reset_hour: number
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: number
          last_auto_reset_at?: string | null
          reset_hour?: number
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: number
          last_auto_reset_at?: string | null
          reset_hour?: number
          updated_at?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          round_number: number
          wordle_word: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          round_number?: number
          wordle_word?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          round_number?: number
          wordle_word?: string | null
        }
        Relationships: []
      }
      scoring_settings: {
        Row: {
          attempt_multipliers: Json
          difficulty_weights: Json
          distance_parameter: number
          id: number
          max_guesses_per_challenge: number | null
          updated_at: string
          wordle_attempt_points: Json
          wordle_points: number
        }
        Insert: {
          attempt_multipliers?: Json
          difficulty_weights?: Json
          distance_parameter?: number
          id?: number
          max_guesses_per_challenge?: number | null
          updated_at?: string
          wordle_attempt_points?: Json
          wordle_points?: number
        }
        Update: {
          attempt_multipliers?: Json
          difficulty_weights?: Json
          distance_parameter?: number
          id?: number
          max_guesses_per_challenge?: number | null
          updated_at?: string
          wordle_attempt_points?: Json
          wordle_points?: number
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
      wordle_scores: {
        Row: {
          attempts: number
          created_at: string
          device_id: string
          id: string
          player_name: string
          round_id: string
          solved: boolean
        }
        Insert: {
          attempts: number
          created_at?: string
          device_id: string
          id?: string
          player_name: string
          round_id: string
          solved?: boolean
        }
        Update: {
          attempts?: number
          created_at?: string
          device_id?: string
          id?: string
          player_name?: string
          round_id?: string
          solved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "wordle_scores_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
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
