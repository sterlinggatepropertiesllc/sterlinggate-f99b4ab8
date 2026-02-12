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
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      applications: {
        Row: {
          applicant_id: string
          background_check_consent: boolean
          created_at: string
          employment_info: Json
          id: string
          payment_id: string | null
          personal_info: Json
          property_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
        }
        Insert: {
          applicant_id: string
          background_check_consent?: boolean
          created_at?: string
          employment_info?: Json
          id?: string
          payment_id?: string | null
          personal_info?: Json
          property_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          background_check_consent?: boolean
          created_at?: string
          employment_info?: Json
          id?: string
          payment_id?: string | null
          personal_info?: Json
          property_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_adjustments: {
        Row: {
          adjustment_type: string
          amount: number
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          new_balance: number
          previous_balance: number
          tenant_id: string
        }
        Insert: {
          adjustment_type: string
          amount: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          new_balance: number
          previous_balance: number
          tenant_id: string
        }
        Update: {
          adjustment_type?: string
          amount?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          new_balance?: number
          previous_balance?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balance_adjustments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          application_id: string | null
          created_at: string
          document_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          lease_id: string | null
          owner_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          document_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          lease_id?: string | null
          owner_id: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          lease_id?: string | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_people: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          created_at: string | null
          email: string
          id: string
          manager_id: string
          manager_notes: string | null
          message: string
          name: string
          phone: string | null
          property_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          manager_id: string
          manager_notes?: string | null
          message: string
          name: string
          phone?: string | null
          property_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          manager_id?: string
          manager_notes?: string | null
          message?: string
          name?: string
          phone?: string | null
          property_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          additional_clauses: string | null
          cam_charges: number | null
          created_at: string
          document_hash: string | null
          end_date: string
          grace_period_days: number | null
          id: string
          insurance_responsibility: string | null
          late_after_day: number | null
          late_fee_daily_amount: number | null
          late_fee_flat_amount: number | null
          late_fee_max_amount: number | null
          late_fee_percentage: number | null
          late_fee_type: string | null
          lease_document_url: string | null
          lease_type: string | null
          manager_id: string
          monthly_rent: number
          property_id: string
          property_tax_responsibility: string | null
          renewal_terms: string | null
          rent_due_day: number | null
          security_deposit: number | null
          signed_document_url: string | null
          start_date: string
          status: Database["public"]["Enums"]["lease_status"]
          tenant_id: string
          terms: string | null
          updated_at: string
        }
        Insert: {
          additional_clauses?: string | null
          cam_charges?: number | null
          created_at?: string
          document_hash?: string | null
          end_date: string
          grace_period_days?: number | null
          id?: string
          insurance_responsibility?: string | null
          late_after_day?: number | null
          late_fee_daily_amount?: number | null
          late_fee_flat_amount?: number | null
          late_fee_max_amount?: number | null
          late_fee_percentage?: number | null
          late_fee_type?: string | null
          lease_document_url?: string | null
          lease_type?: string | null
          manager_id: string
          monthly_rent: number
          property_id: string
          property_tax_responsibility?: string | null
          renewal_terms?: string | null
          rent_due_day?: number | null
          security_deposit?: number | null
          signed_document_url?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["lease_status"]
          tenant_id: string
          terms?: string | null
          updated_at?: string
        }
        Update: {
          additional_clauses?: string | null
          cam_charges?: number | null
          created_at?: string
          document_hash?: string | null
          end_date?: string
          grace_period_days?: number | null
          id?: string
          insurance_responsibility?: string | null
          late_after_day?: number | null
          late_fee_daily_amount?: number | null
          late_fee_flat_amount?: number | null
          late_fee_max_amount?: number | null
          late_fee_percentage?: number | null
          late_fee_type?: string | null
          lease_document_url?: string | null
          lease_type?: string | null
          manager_id?: string
          monthly_rent?: number
          property_id?: string
          property_tax_responsibility?: string | null
          renewal_terms?: string | null
          rent_due_day?: number | null
          security_deposit?: number | null
          signed_document_url?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["lease_status"]
          tenant_id?: string
          terms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leases_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_attachments: {
        Row: {
          created_at: string | null
          file_name: string | null
          file_type: string
          file_url: string
          id: string
          maintenance_id: string
        }
        Insert: {
          created_at?: string | null
          file_name?: string | null
          file_type: string
          file_url: string
          id?: string
          maintenance_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string | null
          file_type?: string
          file_url?: string
          id?: string
          maintenance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_attachments_maintenance_id_fkey"
            columns: ["maintenance_id"]
            isOneToOne: false
            referencedRelation: "maintenance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          attachments: Json
          category: string
          created_at: string
          description: string | null
          id: string
          manager_id: string
          ownership_split_percentage: number
          partner_share_amount: number | null
          performed_by: string
          performed_by_name: string | null
          performed_date: string
          property_id: string
          status: string
          title: string
          total_cost: number
        }
        Insert: {
          attachments?: Json
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          manager_id: string
          ownership_split_percentage?: number
          partner_share_amount?: number | null
          performed_by?: string
          performed_by_name?: string | null
          performed_date?: string
          property_id: string
          status?: string
          title: string
          total_cost?: number
        }
        Update: {
          attachments?: Json
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string
          ownership_split_percentage?: number
          partner_share_amount?: number | null
          performed_by?: string
          performed_by_name?: string | null
          performed_date?: string
          property_id?: string
          status?: string
          title?: string
          total_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          created_at: string
          id: string
          is_read: boolean
          property_id: string | null
          read_at: string | null
          recipient_id: string
          sender_id: string
          subject: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          property_id?: string | null
          read_at?: string | null
          recipient_id: string
          sender_id: string
          subject?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          property_id?: string | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string
          discord_enabled: boolean
          discord_webhook_url: string | null
          id: string
          notify_application_approved: boolean
          notify_application_received: boolean
          notify_application_rejected: boolean
          notify_lease_signed: boolean
          notify_maintenance_request: boolean
          notify_message_received: boolean
          notify_rent_received: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discord_enabled?: boolean
          discord_webhook_url?: string | null
          id?: string
          notify_application_approved?: boolean
          notify_application_received?: boolean
          notify_application_rejected?: boolean
          notify_lease_signed?: boolean
          notify_maintenance_request?: boolean
          notify_message_received?: boolean
          notify_rent_received?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discord_enabled?: boolean
          discord_webhook_url?: string | null
          id?: string
          notify_application_approved?: boolean
          notify_application_received?: boolean
          notify_application_rejected?: boolean
          notify_lease_signed?: boolean
          notify_maintenance_request?: boolean
          notify_message_received?: boolean
          notify_rent_received?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          convenience_fee: number | null
          created_at: string
          id: string
          lease_id: string | null
          notes: string | null
          payment_date: string
          payment_method: string | null
          payment_method_type: string | null
          payment_type: string | null
          property_id: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          convenience_fee?: number | null
          created_at?: string
          id?: string
          lease_id?: string | null
          notes?: string | null
          payment_date: string
          payment_method?: string | null
          payment_method_type?: string | null
          payment_type?: string | null
          property_id: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          convenience_fee?: number | null
          created_at?: string
          id?: string
          lease_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_method_type?: string | null
          payment_type?: string | null
          property_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          telegram_chat_id: number | null
          telegram_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          telegram_chat_id?: number | null
          telegram_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          telegram_chat_id?: number | null
          telegram_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          amenities: string[] | null
          bathrooms: number | null
          bedrooms: number | null
          city: string
          created_at: string
          description: string | null
          id: string
          manager_id: string
          photos: string[] | null
          property_type: string | null
          rent_amount: number
          square_feet: number | null
          state: string
          status: Database["public"]["Enums"]["property_status"]
          updated_at: string
          zip_code: string
        }
        Insert: {
          address: string
          amenities?: string[] | null
          bathrooms?: number | null
          bedrooms?: number | null
          city: string
          created_at?: string
          description?: string | null
          id?: string
          manager_id: string
          photos?: string[] | null
          property_type?: string | null
          rent_amount: number
          square_feet?: number | null
          state: string
          status?: Database["public"]["Enums"]["property_status"]
          updated_at?: string
          zip_code: string
        }
        Update: {
          address?: string
          amenities?: string[] | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string
          photos?: string[] | null
          property_type?: string | null
          rent_amount?: number
          square_feet?: number | null
          state?: string
          status?: Database["public"]["Enums"]["property_status"]
          updated_at?: string
          zip_code?: string
        }
        Relationships: []
      }
      rent_charges: {
        Row: {
          charged_at: string | null
          created_at: string | null
          id: string
          late_fee_amount: number | null
          late_fee_applied: boolean | null
          late_fee_applied_at: string | null
          late_fee_waived: boolean | null
          late_fee_waived_at: string | null
          late_fee_waived_by: string | null
          lease_id: string | null
          notes: string | null
          rent_amount: number
          rent_period: string
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          charged_at?: string | null
          created_at?: string | null
          id?: string
          late_fee_amount?: number | null
          late_fee_applied?: boolean | null
          late_fee_applied_at?: string | null
          late_fee_waived?: boolean | null
          late_fee_waived_at?: string | null
          late_fee_waived_by?: string | null
          lease_id?: string | null
          notes?: string | null
          rent_amount: number
          rent_period: string
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          charged_at?: string | null
          created_at?: string | null
          id?: string
          late_fee_amount?: number | null
          late_fee_applied?: boolean | null
          late_fee_applied_at?: string | null
          late_fee_waived?: boolean | null
          late_fee_waived_at?: string | null
          late_fee_waived_by?: string | null
          lease_id?: string | null
          notes?: string | null
          rent_amount?: number
          rent_period?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rent_charges_late_fee_waived_by_fkey"
            columns: ["late_fee_waived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_charges_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_charges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures: {
        Row: {
          hash_id: string
          id: string
          ip_address: string | null
          lease_id: string
          signature_data: string
          signature_type: string
          signed_at: string
          signer_id: string
          user_agent: string | null
        }
        Insert: {
          hash_id: string
          id?: string
          ip_address?: string | null
          lease_id: string
          signature_data: string
          signature_type?: string
          signed_at?: string
          signer_id: string
          user_agent?: string | null
        }
        Update: {
          hash_id?: string
          id?: string
          ip_address?: string | null
          lease_id?: string
          signature_data?: string
          signature_type?: string
          signed_at?: string
          signer_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signatures_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatures_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_notification_deliveries: {
        Row: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string | null
          last_error: string | null
          message_text: string
          metadata: Json | null
          status: string
          telegram_chat_id: number | null
          topic_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          message_text: string
          metadata?: Json | null
          status?: string
          telegram_chat_id?: number | null
          topic_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          message_text?: string
          metadata?: Json | null
          status?: string
          telegram_chat_id?: number | null
          topic_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_notification_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_notification_prefs: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          topic_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          topic_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          topic_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_notification_prefs_topic_key_fkey"
            columns: ["topic_key"]
            isOneToOne: false
            referencedRelation: "telegram_notification_topics"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "telegram_notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_notification_topics: {
        Row: {
          description: string
          key: string
          role_scope: string
        }
        Insert: {
          description: string
          key: string
          role_scope: string
        }
        Update: {
          description?: string
          key?: string
          role_scope?: string
        }
        Relationships: []
      }
      tenant_properties: {
        Row: {
          created_at: string | null
          grace_period_days: number | null
          id: string
          is_primary: boolean | null
          late_fee_daily_amount: number | null
          late_fee_flat_amount: number | null
          late_fee_max_amount: number | null
          late_fee_percentage: number | null
          late_fee_type: string | null
          lease_end_date: string | null
          lease_start_date: string | null
          notes: string | null
          property_id: string
          rent_amount: number | null
          rent_due_day: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          grace_period_days?: number | null
          id?: string
          is_primary?: boolean | null
          late_fee_daily_amount?: number | null
          late_fee_flat_amount?: number | null
          late_fee_max_amount?: number | null
          late_fee_percentage?: number | null
          late_fee_type?: string | null
          lease_end_date?: string | null
          lease_start_date?: string | null
          notes?: string | null
          property_id: string
          rent_amount?: number | null
          rent_due_day?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          grace_period_days?: number | null
          id?: string
          is_primary?: boolean | null
          late_fee_daily_amount?: number | null
          late_fee_flat_amount?: number | null
          late_fee_max_amount?: number | null
          late_fee_percentage?: number | null
          late_fee_type?: string | null
          lease_end_date?: string | null
          lease_start_date?: string | null
          notes?: string | null
          property_id?: string
          rent_amount?: number | null
          rent_due_day?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_properties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          auto_apply_late_fees: boolean | null
          auto_charge_rent: boolean | null
          created_at: string
          created_by: string | null
          current_balance: number | null
          id: string
          is_active: boolean
          lease_end_date: string | null
          lease_start_date: string | null
          manager_id: string | null
          notes: string | null
          property_id: string | null
          rent_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_apply_late_fees?: boolean | null
          auto_charge_rent?: boolean | null
          created_at?: string
          created_by?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean
          lease_end_date?: string | null
          lease_start_date?: string | null
          manager_id?: string | null
          notes?: string | null
          property_id?: string | null
          rent_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_apply_late_fees?: boolean | null
          auto_charge_rent?: boolean | null
          created_at?: string
          created_by?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean
          lease_end_date?: string | null
          lease_start_date?: string | null
          manager_id?: string | null
          notes?: string | null
          property_id?: string | null
          rent_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      apply_balance_adjustment: {
        Args: {
          _adjustment_type: string
          _amount: number
          _created_by?: string
          _description?: string
          _tenant_id: string
        }
        Returns: Json
      }
      apply_rent_late_fee: {
        Args: {
          _created_by?: string
          _override_amount?: number
          _rent_charge_id: string
        }
        Returns: Json
      }
      assign_tenant_role: { Args: { _user_id: string }; Returns: undefined }
      calculate_late_fee: {
        Args: { _days_late: number; _lease_id: string; _rent_amount: number }
        Returns: number
      }
      charge_tenant_rent: {
        Args: {
          _created_by?: string
          _rent_period?: string
          _tenant_id: string
        }
        Returns: Json
      }
      create_notification: {
        Args: {
          _message: string
          _metadata?: Json
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_id: string
        }
        Returns: string
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      hard_delete_tenant: { Args: { _tenant_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_tenant_for_property: {
        Args: { _property_id: string; _user_id: string }
        Returns: boolean
      }
      list_property_managers_for_messaging: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      process_late_fees: { Args: never; Returns: Json }
      process_monthly_rent: { Args: never; Returns: Json }
      queue_telegram_notification: {
        Args: {
          _entity_id?: string
          _idempotency_source?: string
          _message: string
          _metadata?: Json
          _topic_key: string
          _user_id: string
        }
        Returns: undefined
      }
      revoke_tenant_role: { Args: { _user_id: string }; Returns: undefined }
      waive_rent_late_fee: {
        Args: { _rent_charge_id: string; _waived_by?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "tenant" | "property_manager"
      application_status: "pending" | "under_review" | "approved" | "rejected"
      lease_status:
        | "draft"
        | "pending_tenant_signature"
        | "pending_manager_signature"
        | "completed"
        | "expired"
      notification_type:
        | "application_received"
        | "application_approved"
        | "application_rejected"
        | "rent_received"
        | "maintenance_request"
        | "lease_signed"
        | "message_received"
        | "inquiry_received"
      property_status: "available" | "occupied" | "off_market"
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
      app_role: ["tenant", "property_manager"],
      application_status: ["pending", "under_review", "approved", "rejected"],
      lease_status: [
        "draft",
        "pending_tenant_signature",
        "pending_manager_signature",
        "completed",
        "expired",
      ],
      notification_type: [
        "application_received",
        "application_approved",
        "application_rejected",
        "rent_received",
        "maintenance_request",
        "lease_signed",
        "message_received",
        "inquiry_received",
      ],
      property_status: ["available", "occupied", "off_market"],
    },
  },
} as const
