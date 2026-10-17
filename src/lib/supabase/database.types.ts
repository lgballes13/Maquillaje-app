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
          preorder_balance_days: number;
          preorder_delivery_days: number;
          preorder_deposit_percent: number;
          reschedule_penalty_percent: number;
          reschedule_window_hours: number;
          shipping_fee_cop: number;
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
          preorder_balance_days?: number;
          preorder_delivery_days: number;
          preorder_deposit_percent: number;
          reschedule_penalty_percent: number;
          reschedule_window_hours: number;
          shipping_fee_cop?: number;
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
          preorder_balance_days?: number;
          preorder_delivery_days?: number;
          preorder_deposit_percent?: number;
          reschedule_penalty_percent?: number;
          reschedule_window_hours?: number;
          shipping_fee_cop?: number;
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
          order_id: string | null;
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
          order_id?: string | null;
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
          order_id?: string | null;
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
          {
            foreignKeyName: "credit_movements_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: number;
          line_total_cop: number;
          order_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_price_cop: number;
        };
        ComputedFields: never;
        Insert: {
          id?: never;
          line_total_cop: number;
          order_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_price_cop: number;
        };
        Update: {
          id?: never;
          line_total_cop?: number;
          order_id?: string;
          product_id?: string;
          product_name?: string;
          quantity?: number;
          unit_price_cop?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      order_payments: {
        Row: {
          amount_in_cents: number;
          approved_at: string | null;
          created_at: string;
          currency: string;
          id: string;
          order_id: string;
          payment_method: string | null;
          provider: string;
          provider_transaction_id: string | null;
          reference: string;
          stage: Database["public"]["Enums"]["payment_stage"];
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_in_cents: number;
          approved_at?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          order_id: string;
          payment_method?: string | null;
          provider?: string;
          provider_transaction_id?: string | null;
          reference: string;
          stage?: Database["public"]["Enums"]["payment_stage"];
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Update: {
          amount_in_cents?: number;
          approved_at?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          order_id?: string;
          payment_method?: string | null;
          provider?: string;
          provider_transaction_id?: string | null;
          reference?: string;
          stage?: Database["public"]["Enums"]["payment_stage"];
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          address: string | null;
          arrival_email_sent_at: string | null;
          arrived_at: string | null;
          balance_due_at: string | null;
          cancelled_at: string | null;
          city: string | null;
          confirmation_sent_at: string | null;
          created_at: string;
          credit_applied_cop: number;
          customer_id: string;
          customer_notes: string | null;
          delivery_method: Database["public"]["Enums"]["delivery_method"];
          deposit_cop: number | null;
          deposit_email_sent_at: string | null;
          deposit_paid_at: string | null;
          hold_expires_at: string | null;
          id: string;
          kind: Database["public"]["Enums"]["order_kind"];
          needs_review: boolean;
          number: number;
          paid_at: string | null;
          phone: string;
          recipient_name: string;
          review_note: string | null;
          rules_version: number;
          shipping_cop: number;
          status: Database["public"]["Enums"]["order_status"];
          subtotal_cop: number;
          total_cop: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          arrival_email_sent_at?: string | null;
          arrived_at?: string | null;
          balance_due_at?: string | null;
          cancelled_at?: string | null;
          city?: string | null;
          confirmation_sent_at?: string | null;
          created_at?: string;
          credit_applied_cop?: number;
          customer_id: string;
          customer_notes?: string | null;
          delivery_method: Database["public"]["Enums"]["delivery_method"];
          deposit_cop?: number | null;
          deposit_email_sent_at?: string | null;
          deposit_paid_at?: string | null;
          hold_expires_at?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["order_kind"];
          needs_review?: boolean;
          number?: never;
          paid_at?: string | null;
          phone: string;
          recipient_name: string;
          review_note?: string | null;
          rules_version: number;
          shipping_cop: number;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_cop: number;
          total_cop: number;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          arrival_email_sent_at?: string | null;
          arrived_at?: string | null;
          balance_due_at?: string | null;
          cancelled_at?: string | null;
          city?: string | null;
          confirmation_sent_at?: string | null;
          created_at?: string;
          credit_applied_cop?: number;
          customer_id?: string;
          customer_notes?: string | null;
          delivery_method?: Database["public"]["Enums"]["delivery_method"];
          deposit_cop?: number | null;
          deposit_email_sent_at?: string | null;
          deposit_paid_at?: string | null;
          hold_expires_at?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["order_kind"];
          needs_review?: boolean;
          number?: never;
          paid_at?: string | null;
          phone?: string;
          recipient_name?: string;
          review_note?: string | null;
          rules_version?: number;
          shipping_cop?: number;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_cop?: number;
          total_cop?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_rules_version_fkey";
            columns: ["rules_version"];
            isOneToOne: false;
            referencedRelation: "business_rules";
            referencedColumns: ["version"];
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
      product_categories: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      product_images: {
        Row: {
          alt_text: string;
          created_at: string;
          created_by: string | null;
          id: string;
          product_id: string;
          sort_order: number;
          storage_path: string;
        };
        ComputedFields: never;
        Insert: {
          alt_text: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          product_id: string;
          sort_order?: number;
          storage_path: string;
        };
        Update: {
          alt_text?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          product_id?: string;
          sort_order?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_waitlist: {
        Row: {
          created_at: string;
          customer_id: string;
          id: number;
          notified_at: string | null;
          product_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          customer_id: string;
          id?: never;
          notified_at?: string | null;
          product_id: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          id?: never;
          notified_at?: string | null;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_waitlist_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          allow_preorder: boolean;
          category_id: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          price_cop: number;
          sort_order: number;
          stock: number;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          allow_preorder?: boolean;
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          price_cop: number;
          sort_order?: number;
          stock?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          allow_preorder?: boolean;
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          price_cop?: number;
          sort_order?: number;
          stock?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
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
      apply_order_payment_event: {
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
      cancel_my_order: { Args: { p_order_id: string }; Returns: undefined };
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
      create_order: {
        Args: {
          p_address: string;
          p_city: string;
          p_customer_notes: string;
          p_delivery_method: Database["public"]["Enums"]["delivery_method"];
          p_items: Json;
          p_phone: string;
          p_recipient_name: string;
          p_rules_version: number;
        };
        Returns: string;
      };
      create_preorder: {
        Args: {
          p_address: string;
          p_city: string;
          p_customer_notes: string;
          p_delivery_method: Database["public"]["Enums"]["delivery_method"];
          p_phone: string;
          p_product_id: string;
          p_quantity: number;
          p_recipient_name: string;
          p_rules_version: number;
        };
        Returns: string;
      };
      expire_credits: { Args: Record<PropertyKey, never>; Returns: number };
      expire_orders: { Args: Record<PropertyKey, never>; Returns: number };
      get_busy_periods: {
        Args: { p_from: string; p_to: string };
        Returns: {
          ends_at: string;
          starts_at: string;
        }[];
      };
      get_product_availability: {
        Args: { p_product_ids: string[] };
        Returns: {
          available: number;
          product_id: string;
        }[];
      };
      has_role: { Args: { p_role: Database["public"]["Enums"]["app_role"] }; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      mark_attendance: {
        Args: { p_appointment_id: string; p_attended: boolean };
        Returns: undefined;
      };
      mark_order_reviewed: { Args: { p_order_id: string }; Returns: undefined };
      mark_preorder_arrived: {
        Args: { p_order_id: string };
        Returns: Database["public"]["Enums"]["order_status"];
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
      prepare_order_payment: {
        Args: { p_order_id: string };
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
      set_order_status: {
        Args: { p_order_id: string; p_status: Database["public"]["Enums"]["order_status"] };
        Returns: undefined;
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
        | "expired"
        | "applied_to_order"
        | "preorder_unpaid";
      delivery_method: "pickup" | "shipping";
      order_kind: "purchase" | "preorder";
      order_status:
        | "pending_payment"
        | "deposit_paid"
        | "awaiting_balance"
        | "paid"
        | "ready"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "expired";
      payment_stage: "full" | "deposit" | "balance";
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
        "applied_to_order",
        "preorder_unpaid",
      ],
      delivery_method: ["pickup", "shipping"],
      order_kind: ["purchase", "preorder"],
      order_status: [
        "pending_payment",
        "deposit_paid",
        "awaiting_balance",
        "paid",
        "ready",
        "shipped",
        "delivered",
        "cancelled",
        "expired",
      ],
      payment_stage: ["full", "deposit", "balance"],
      payment_status: ["pending", "approved", "declined", "voided", "error"],
    },
  },
} as const;
