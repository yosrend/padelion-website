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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      addons: {
        Row: {
          id: string
          is_active: boolean
          name: string
          price_idr: number
          sort: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          price_idr: number
          sort?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          price_idr?: number
          sort?: number
        }
        Relationships: []
      }
      booking_addons: {
        Row: {
          addon_id: string
          booking_id: string
          id: string
          qty: number
          unit_price_idr: number
        }
        Insert: {
          addon_id: string
          booking_id: string
          id?: string
          qty?: number
          unit_price_idr: number
        }
        Update: {
          addon_id?: string
          booking_id?: string
          id?: string
          qty?: number
          unit_price_idr?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          addons_idr: number
          balance_due_at: string | null
          checked_in_at: string | null
          code: string
          court_id: string
          created_at: string
          ends_at: string
          guest_email: string | null
          guest_name: string
          guest_note: string | null
          guest_whatsapp: string
          hold_expires_at: string | null
          id: string
          is_demo: boolean
          paid_idr: number
          starts_at: string
          status: string
          subtotal_idr: number
          total_idr: number
        }
        Insert: {
          addons_idr?: number
          balance_due_at?: string | null
          checked_in_at?: string | null
          code?: string
          court_id: string
          created_at?: string
          ends_at: string
          guest_email?: string | null
          guest_name: string
          guest_note?: string | null
          guest_whatsapp: string
          hold_expires_at?: string | null
          id?: string
          is_demo?: boolean
          paid_idr?: number
          starts_at: string
          status?: string
          subtotal_idr?: number
          total_idr?: number
        }
        Update: {
          addons_idr?: number
          balance_due_at?: string | null
          checked_in_at?: string | null
          code?: string
          court_id?: string
          created_at?: string
          ends_at?: string
          guest_email?: string | null
          guest_name?: string
          guest_note?: string | null
          guest_whatsapp?: string
          hold_expires_at?: string | null
          id?: string
          is_demo?: boolean
          paid_idr?: number
          starts_at?: string
          status?: string
          subtotal_idr?: number
          total_idr?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      court_blocks: {
        Row: {
          court_id: string
          created_at: string
          ends_at: string
          id: string
          is_demo: boolean
          reason: string | null
          starts_at: string
        }
        Insert: {
          court_id: string
          created_at?: string
          ends_at: string
          id?: string
          is_demo?: boolean
          reason?: string | null
          starts_at: string
        }
        Update: {
          court_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          is_demo?: boolean
          reason?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_blocks_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          id: string
          is_active: boolean
          kind: string
          name: string
          sort: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          kind: string
          name: string
          sort?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          sort?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          booking_id: string | null
          channel: string
          id: string
          kind: string
          send_at: string
          sent_at: string | null
        }
        Insert: {
          body: string
          booking_id?: string | null
          channel?: string
          id?: string
          kind: string
          send_at?: string
          sent_at?: string | null
        }
        Update: {
          body?: string
          booking_id?: string | null
          channel?: string
          id?: string
          kind?: string
          send_at?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_idr: number
          booking_id: string | null
          created_at: string
          flag: string | null
          id: string
          is_demo: boolean
          method: string
          note: string | null
          payer: string | null
          resolution: string | null
          status: string
        }
        Insert: {
          amount_idr: number
          booking_id?: string | null
          created_at?: string
          flag?: string | null
          id?: string
          is_demo?: boolean
          method: string
          note?: string | null
          payer?: string | null
          resolution?: string | null
          status?: string
        }
        Update: {
          amount_idr?: number
          booking_id?: string | null
          created_at?: string
          flag?: string | null
          id?: string
          is_demo?: boolean
          method?: string
          note?: string | null
          payer?: string | null
          resolution?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      price_rules: {
        Row: {
          court_id: string
          id: string
          off_peak_idr: number
          peak_idr: number
          weekday_peak_end: number
          weekday_peak_start: number
          weekend_all_peak: boolean
        }
        Insert: {
          court_id: string
          id?: string
          off_peak_idr: number
          peak_idr: number
          weekday_peak_end?: number
          weekday_peak_start?: number
          weekend_all_peak?: boolean
        }
        Update: {
          court_id?: string
          id?: string
          off_peak_idr?: number
          peak_idr?: number
          weekday_peak_end?: number
          weekday_peak_start?: number
          weekend_all_peak?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "price_rules_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      rain_events: {
        Row: {
          court_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          note: string | null
          starts_at: string
        }
        Insert: {
          court_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          note?: string | null
          starts_at: string
        }
        Update: {
          court_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          note?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rain_events_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          email: string | null
          id: string
          name: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string | null
        }
        Insert: {
          email?: string | null
          id?: string
          name: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id?: string | null
        }
        Update: {
          email?: string | null
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string | null
        }
        Relationships: []
      }
      system_log: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          kind: string
          message: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          kind: string
          message: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_settings: {
        Row: {
          balance_hours: number
          deposit_pct: number
          hold_minutes: number
          id: number
          offer_minutes: number
          reschedule_hours: number
          updated_at: string
        }
        Insert: {
          balance_hours?: number
          deposit_pct?: number
          hold_minutes?: number
          id?: number
          offer_minutes?: number
          reschedule_hours?: number
          updated_at?: string
        }
        Update: {
          balance_hours?: number
          deposit_pct?: number
          hold_minutes?: number
          id?: number
          offer_minutes?: number
          reschedule_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      waitlist_entries: {
        Row: {
          court_id: string
          created_at: string
          guest: string
          id: string
          is_demo: boolean
          offer_expires_at: string | null
          position: number
          starts_at: string
          status: string
          whatsapp: string | null
        }
        Insert: {
          court_id: string
          created_at?: string
          guest: string
          id?: string
          is_demo?: boolean
          offer_expires_at?: string | null
          position: number
          starts_at: string
          status?: string
          whatsapp?: string | null
        }
        Update: {
          court_id?: string
          created_at?: string
          guest?: string
          id?: string
          is_demo?: boolean
          offer_expires_at?: string | null
          position?: number
          starts_at?: string
          status?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      week_baseline: {
        Row: {
          data: Json
          id: number
        }
        Insert: {
          data: Json
          id?: number
        }
        Update: {
          data?: Json
          id?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _jt: { Args: { _t: string }; Returns: string }
      booking_is_active: {
        Args: { b: Database["public"]["Tables"]["bookings"]["Row"] }
        Returns: boolean
      }
      cancel_booking: { Args: { _booking: string }; Returns: undefined }
      check_in: { Args: { _code: string; _wa4?: string }; Returns: Json }
      create_block: {
        Args: {
          _court: string
          _ends: string
          _reason: string
          _starts: string
        }
        Returns: number
      }
      create_hold: {
        Args: {
          _addons: Json
          _court: string
          _email: string
          _minutes: number
          _name: string
          _note?: string
          _starts: string
          _wa: string
        }
        Returns: string
      }
      end_hold_and_offer: { Args: { _booking: string }; Returns: undefined }
      find_bookings: { Args: { _otp: string; _wa: string }; Returns: Json }
      get_availability: {
        Args: { _date: string }
        Returns: {
          court_id: string
          ends_at: string
          kind: string
          starts_at: string
        }[]
      }
      get_booking: { Args: { _code: string; _wa: string }; Returns: Json }
      get_offer: { Args: { _id: string }; Returns: Json }
      is_owner: { Args: { _uid: string }; Returns: boolean }
      is_staff: { Args: { _uid: string }; Returns: boolean }
      join_waitlist: {
        Args: { _court: string; _name: string; _starts: string; _wa: string }
        Returns: number
      }
      mark_paid: {
        Args: { _booking: string; _method: string }
        Returns: undefined
      }
      move_booking: {
        Args: { _booking: string; _court: string; _starts: string }
        Returns: undefined
      }
      my_staff: {
        Args: never
        Returns: {
          name: string
          role: Database["public"]["Enums"]["staff_role"]
        }[]
      }
      norm_wa: { Args: { _wa: string }; Returns: string }
      offer_next: {
        Args: { _court: string; _starts: string }
        Returns: undefined
      }
      owner_week: { Args: never; Returns: Json }
      pass_offer: { Args: { _id: string }; Returns: undefined }
      pay_balance: { Args: { _code: string; _wa: string }; Returns: Json }
      pay_booking: {
        Args: { _code: string; _mode: string; _wa: string }
        Returns: Json
      }
      price_for: {
        Args: { _court: string; _minutes: number; _starts: string }
        Returns: number
      }
      reschedule_booking: {
        Args: {
          _code: string
          _court: string
          _minutes: number
          _starts: string
          _wa: string
        }
        Returns: Json
      }
      reset_demo: { Args: never; Returns: undefined }
      resolve_payment: {
        Args: { _action: string; _booking?: string; _payment: string }
        Returns: undefined
      }
      run_minute_jobs: { Args: never; Returns: undefined }
      slot_free: {
        Args: { _court: string; _e: string; _except: string; _s: string }
        Returns: boolean
      }
      take_offer: { Args: { _id: string }; Returns: Json }
      vs: {
        Args: never
        Returns: {
          balance_hours: number
          deposit_pct: number
          hold_minutes: number
          id: number
          offer_minutes: number
          reschedule_hours: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "venue_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      waitlist_offer_now: { Args: { _entry: string }; Returns: undefined }
      waitlist_remove: { Args: { _entry: string }; Returns: undefined }
    }
    Enums: {
      staff_role: "front_desk" | "owner"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      staff_role: ["front_desk", "owner"],
    },
  },
} as const
