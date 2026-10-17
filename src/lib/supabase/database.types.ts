export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      appointments: {
        Row: {
          attendance_marked_at: string | null;
          blocked_until: string;
          cancelled_at: string | null;
          confirmation_sent_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          credit_applied_cop: number;
          customer_id: string;
          customer_notes: string | null;
          deposit_cop: number;
          deposit_percent: number;
          duration_minutes: number;
          ends_at: string;
          hold_expires_at: string | null;
          id: string;
          needs_review: boolean;
          period: unknown;
          policy_accepted_at: string;
          price_cop: number;
          reminder_sent_at: string | null;
          rescheduled_from: string | null;
          review_note: string | null;
          rules_version: number;
          service_id: string;
          service_name: string;
          starts_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attendance_marked_at?: string | null;
          blocked_until: string;
          cancelled_at?: string | null;
          confirmation_sent_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          credit_applied_cop?: number;
          customer_id: string;
          customer_notes?: string | null;
          deposit_cop: number;
          deposit_percent: number;
          duration_minutes: number;
          ends_at: string;
          hold_expires_at?: string | null;
          id?: string;
          needs_review?: boolean;
          period?: never;
          policy_accepted_at: string;
          price_cop: number;
          reminder_sent_at?: string | null;
          rescheduled_from?: string | null;
          review_note?: string | null;
          rules_version: number;
          service_id: string;
          service_name: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
        };
        Update: {
          attendance_marked_at?: string | null;
          blocked_until?: string;
          cancelled_at?: string | null;
          confirmation_sent_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          credit_applied_cop?: number;
          customer_id?: string;
          customer_notes?: string | null;
          deposit_cop?: number;
          deposit_percent?: number;
          duration_minutes?: number;
          ends_at?: string;
          hold_expires_at?: string | null;
          id?: string;
          needs_review?: boolean;
          period?: never;
          policy_accepted_at?: string;
          price_cop?: number;
          reminder_sent_at?: string | null;
          rescheduled_from?: string | null;
          review_note?: string | null;
          rules_version?: number;
          service_id?: string;
          service_name?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_rescheduled_from_fkey";
            columns: ["rescheduled_from"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_rules_version_fkey";
            columns: ["rules_version"];
            isOneToOne: false;
            referencedRelation: "business_rules";
            referencedColumns: ["version"];
          },
          {
            foreignKeyName: "appointments_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          id: number;
          new_data: Json | null;
          occurred_at: string;
          old_data: Json | null;
          record_id: string | null;
          table_name: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          id?: never;
          new_data?: Json | null;
          occurred_at?: string;
          old_data?: Json | null;
          record_id?: string | null;
          table_name: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          id?: never;
          new_data?: Json | null;
          occurred_at?: string;
          old_data?: Json | null;
          record_id?: string | null;
          table_name?: string;
        };
        Relationships: [];
      };
      blocked_periods: {
        Row: {
          created_at: string;
          created_by: string | null;
          ends_at: string;
          id: string;
          reason: string | null;
          starts_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          ends_at: string;
          id?: string;
          reason?: string | null;
          starts_at: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          ends_at?: string;
          id?: string;
          reason?: string | null;
          starts_at?: string;
        };
        Relationships: [];
      };
      business_hours: {
        Row: {
          closes_at: string | null;
          is_open: boolean;
          opens_at: string | null;
          updated_at: string;
          updated_by: string | null;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          closes_at?: string | null;
          is_open: boolean;
          opens_at?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          weekday: number;
        };
        Update: {
          closes_at?: string | null;
          is_open?: boolean;
          opens_at?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          weekday?: number;
        };
        Relationships: [];
      };
      business_rules: {
        Row: {
          booking_hold_minutes: number;
          buffer_minutes: number;
          change_reason: string | null;
          created_at: string;
          created_by: string | null;
          credit_validity_days: number;
          deposit_percent: number;
          free_cancellation_hours: number;
          max_booking_days_ahead: number;
          min_booking_notice_hours: number;
          preorder_delivery_days: number;
          preorder_deposit_percent: number;
          reschedule_penalty_percent: number;
          reschedule_window_hours: number;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          booking_hold_minutes: number;
          buffer_minutes: number;
          change_reason?: string | null;
          created_at?: string;
          created_by?: string | null;
          credit_validity_days?: number;
          deposit_percent: number;
          free_cancellation_hours: number;
          max_booking_days_ahead: number;
          min_booking_notice_hours: number;
          preorder_delivery_days: number;
          preorder_deposit_percent: number;
          reschedule_penalty_percent: number;
          reschedule_window_hours: number;
          version?: never;
        };
        Update: {
          booking_hold_minutes?: number;
          buffer_minutes?: number;
          change_reason?: string | null;
          created_at?: string;
          created_by?: string | null;
          credit_validity_days?: number;
          deposit_percent?: number;
          free_cancellation_hours?: number;
          max_booking_days_ahead?: number;
          min_booking_notice_hours?: number;
          preorder_delivery_days?: number;
          preorder_deposit_percent?: number;
          reschedule_penalty_percent?: number;
          reschedule_window_hours?: number;
          version?: never;
        };
        Relationships: [];
      };
      credit_movements: {
        Row: {
          amount_cop: number;
          appointment_id: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          expires_at: string | null;
          id: number;
          lot_id: number | null;
          reason: Database["public"]["Enums"]["credit_reason"];
        };
        ComputedFields: never;
        Insert: {
          amount_cop: number;
          appointment_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          expires_at?: string | null;
          id?: never;
          lot_id?: number | null;
          reason: Database["public"]["Enums"]["credit_reason"];
        };
        Update: {
          amount_cop?: number;
          appointment_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          expires_at?: string | null;
          id?: never;
          lot_id?: number | null;
          reason?: Database["public"]["Enums"]["credit_reason"];
        };
        Relationships: [
          {
            foreignKeyName: "credit_movements_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_movements_lot_id_fkey";
            columns: ["lot_id"];
            isOneToOne: false;
            referencedRelation: "credit_movements";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_events: {
        Row: {
          event_key: string;
          id: number;
          provider: string;
          provider_transaction_id: string | null;
          received_at: string;
          reference: string | null;
          result: string | null;
          source: string;
          status: string | null;
        };
        ComputedFields: never;
        Insert: {
          event_key: string;
          id?: never;
          provider?: string;
          provider_transaction_id?: string | null;
          received_at?: string;
          reference?: string | null;
          result?: string | null;
          source: string;
          status?: string | null;
        };
        Update: {
          event_key?: string;
          id?: never;
          provider?: string;
          provider_transaction_id?: string | null;
          received_at?: string;
          reference?: string | null;
          result?: string | null;
          source?: string;
          status?: string | null;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_in_cents: number;
          appointment_id: string;
          approved_at: string | null;
          created_at: string;
          currency: string;
          id: string;
          payment_method: string | null;
          provider: string;
          provider_transaction_id: string | null;
          reference: string;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_in_cents: number;
          appointment_id: string;
          approved_at?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          payment_method?: string | null;
          provider?: string;
          provider_transaction_id?: string | null;
          reference: string;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Update: {
          amount_in_cents?: number;
          appointment_id?: string;
          approved_at?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          payment_method?: string | null;
          provider?: string;
          provider_transaction_id?: string | null;
          reference?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          marketing_opt_in: boolean;
          phone: string | null;
          privacy_accepted_at: string;
          privacy_policy_version: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          full_name: string;
          id: string;
          marketing_opt_in?: boolean;
          phone?: string | null;
          privacy_accepted_at: string;
          privacy_policy_version: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          marketing_opt_in?: boolean;
          phone?: string | null;
          privacy_accepted_at?: string;
          privacy_policy_version?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          created_at: string;
          description: string | null;
          duration_minutes: number;
          id: string;
          is_active: boolean;
          name: string;
          price_cop: number;
          sort_order: number;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          duration_minutes: number;
          id?: string;
          is_active?: boolean;
          name: string;
          price_cop: number;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          is_active?: boolean;
          name?: string;
          price_cop?: number;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_payment_event: {
        Args: {
          p_amount_in_cents: number;
          p_currency: string;
          p_event_key: string;
          p_payment_method?: string;
          p_reference: string;
          p_source: string;
          p_status: string;
          p_transaction_id: string;
        };
        Returns: string;
      };
      cancel_appointment: { Args: { p_appointment_id: string }; Returns: number };
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      create_booking: {
        Args: {
          p_customer_notes?: string;
          p_rules_version: number;
          p_service_id: string;
          p_starts_at: string;
        };
        Returns: string;
      };
      expire_credits: { Args: Record<PropertyKey, never>; Returns: number };
      get_busy_periods: {
        Args: { p_from: string; p_to: string };
        Returns: {
          ends_at: string;
          starts_at: string;
        }[];
      };
      has_role: { Args: { p_role: Database["public"]["Enums"]["app_role"] }; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      mark_attendance: {
        Args: { p_appointment_id: string; p_attended: boolean };
        Returns: undefined;
      };
      my_credit_balance: { Args: Record<PropertyKey, never>; Returns: number };
      my_credit_lots: {
        Args: Record<PropertyKey, never>;
        Returns: {
          expires_at: string;
          remaining_cop: number;
        }[];
      };
      prepare_appointment_payment: {
        Args: { p_appointment_id: string };
        Returns: {
          amount_in_cents: number;
          expires_at: string;
          reference: string;
        }[];
      };
      reschedule_appointment: {
        Args: { p_appointment_id: string; p_rules_version: number; p_starts_at: string };
        Returns: string;
      };
    };
    Enums: {
      app_role: "admin" | "artist";
      appointment_status:
        | "pending_payment"
        | "confirmed"
        | "expired"
        | "cancelled"
        | "completed"
        | "no_show"
        | "rescheduled";
      credit_reason:
        | "cancellation"
        | "late_cancellation"
        | "reschedule"
        | "no_show_reschedule"
        | "applied_to_booking"
        | "hold_released"
        | "expired";
      payment_status: "pending" | "approved" | "declined" | "voided" | "error";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "artist"],
      appointment_status: [
        "pending_payment",
        "confirmed",
        "expired",
        "cancelled",
        "completed",
        "no_show",
        "rescheduled",
      ],
      credit_reason: [
        "cancellation",
        "late_cancellation",
        "reschedule",
        "no_show_reschedule",
        "applied_to_booking",
        "hold_released",
        "expired",
      ],
      payment_status: ["pending", "approved", "declined", "voided", "error"],
    },
  },
} as const;
