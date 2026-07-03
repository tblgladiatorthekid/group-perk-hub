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
      affiliation_groups: {
        Row: {
          active: boolean
          badge_validity_months: number
          created_at: string
          description: string | null
          email_domains: string[]
          id: string
          name: string
          type: Database["public"]["Enums"]["affiliation_type"]
          updated_at: string
          verification_methods: Database["public"]["Enums"]["verification_method"][]
        }
        Insert: {
          active?: boolean
          badge_validity_months?: number
          created_at?: string
          description?: string | null
          email_domains?: string[]
          id?: string
          name: string
          type: Database["public"]["Enums"]["affiliation_type"]
          updated_at?: string
          verification_methods?: Database["public"]["Enums"]["verification_method"][]
        }
        Update: {
          active?: boolean
          badge_validity_months?: number
          created_at?: string
          description?: string | null
          email_domains?: string[]
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["affiliation_type"]
          updated_at?: string
          verification_methods?: Database["public"]["Enums"]["verification_method"][]
        }
        Relationships: []
      }
      brands: {
        Row: {
          cac_number: string | null
          category: string
          commission_rate: number
          commission_type: Database["public"]["Enums"]["commission_type"]
          contact_email: string
          contact_phone: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          owner_user_id: string
          slug: string | null
          status: Database["public"]["Enums"]["brand_status"]
          updated_at: string
          website: string | null
        }
        Insert: {
          cac_number?: string | null
          category: string
          commission_rate?: number
          commission_type?: Database["public"]["Enums"]["commission_type"]
          contact_email: string
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_user_id: string
          slug?: string | null
          status?: Database["public"]["Enums"]["brand_status"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          cac_number?: string | null
          category?: string
          commission_rate?: number
          commission_type?: Database["public"]["Enums"]["commission_type"]
          contact_email?: string
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_user_id?: string
          slug?: string | null
          status?: Database["public"]["Enums"]["brand_status"]
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      commission_invoices: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          paid_at: string | null
          paystack_ref: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          paid_at?: string | null
          paystack_ref?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          paystack_ref?: string | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_invoices_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_invoices_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          brand_id: string
          channel: Database["public"]["Enums"]["deal_channel"]
          created_at: string
          description: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          end_date: string
          id: string
          image_url: string | null
          per_user_limit: number
          redemption_url: string | null
          rejection_reason: string | null
          slug: string | null
          start_date: string
          status: Database["public"]["Enums"]["deal_status"]
          target_group_ids: string[]
          terms: string | null
          title: string
          total_cap: number | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          channel?: Database["public"]["Enums"]["deal_channel"]
          created_at?: string
          description: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          end_date: string
          id?: string
          image_url?: string | null
          per_user_limit?: number
          redemption_url?: string | null
          rejection_reason?: string | null
          slug?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["deal_status"]
          target_group_ids?: string[]
          terms?: string | null
          title: string
          total_cap?: number | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          channel?: Database["public"]["Enums"]["deal_channel"]
          created_at?: string
          description?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          end_date?: string
          id?: string
          image_url?: string | null
          per_user_limit?: number
          redemption_url?: string | null
          rejection_reason?: string | null
          slug?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["deal_status"]
          target_group_ids?: string[]
          terms?: string | null
          title?: string
          total_cap?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      group_whitelist: {
        Row: {
          created_at: string
          full_name: string | null
          group_id: string
          id: string
          membership_number: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          group_id: string
          id?: string
          membership_number: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          group_id?: string
          id?: string
          membership_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_whitelist_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "affiliation_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          lga: string | null
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          lga?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          lga?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saved_deals: {
        Row: {
          created_at: string
          deal_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_deals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          brand_id: string
          commission_amount: number
          commission_rate: number
          commission_status: Database["public"]["Enums"]["commission_status"]
          commission_type: Database["public"]["Enums"]["commission_type"]
          created_at: string
          deal_id: string
          discount_applied: number
          final_price: number | null
          group_id: string | null
          id: string
          invoice_id: string | null
          method: Database["public"]["Enums"]["deal_channel"]
          original_price: number | null
          redeemed_at: string | null
          redemption_code: string
          status: Database["public"]["Enums"]["transaction_status"]
          user_id: string
        }
        Insert: {
          brand_id: string
          commission_amount?: number
          commission_rate: number
          commission_status?: Database["public"]["Enums"]["commission_status"]
          commission_type: Database["public"]["Enums"]["commission_type"]
          created_at?: string
          deal_id: string
          discount_applied?: number
          final_price?: number | null
          group_id?: string | null
          id?: string
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["deal_channel"]
          original_price?: number | null
          redeemed_at?: string | null
          redemption_code: string
          status?: Database["public"]["Enums"]["transaction_status"]
          user_id: string
        }
        Update: {
          brand_id?: string
          commission_amount?: number
          commission_rate?: number
          commission_status?: Database["public"]["Enums"]["commission_status"]
          commission_type?: Database["public"]["Enums"]["commission_type"]
          created_at?: string
          deal_id?: string
          discount_applied?: number
          final_price?: number | null
          group_id?: string | null
          id?: string
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["deal_channel"]
          original_price?: number | null
          redeemed_at?: string | null
          redemption_code?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "affiliation_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memberships: {
        Row: {
          created_at: string
          expires_at: string | null
          group_id: string
          id: string
          id_document_url: string | null
          membership_number: string | null
          method: Database["public"]["Enums"]["verification_method"]
          rejection_reason: string | null
          status: Database["public"]["Enums"]["membership_status"]
          submitted_email: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          group_id: string
          id?: string
          id_document_url?: string | null
          membership_number?: string | null
          method: Database["public"]["Enums"]["verification_method"]
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          submitted_email?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          group_id?: string
          id?: string
          id_document_url?: string | null
          membership_number?: string | null
          method?: Database["public"]["Enums"]["verification_method"]
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          submitted_email?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "affiliation_groups"
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
      brand_directory: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string | null
          logo_url: string | null
          name: string | null
          slug: string | null
          website: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          website?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      affiliation_type:
        | "cooperative"
        | "alumni"
        | "professional"
        | "nysc"
        | "corporate"
        | "religious"
        | "union"
        | "other"
      app_role: "consumer" | "brand_partner" | "admin"
      brand_status: "pending" | "approved" | "suspended" | "rejected"
      commission_status: "pending" | "invoiced" | "paid"
      commission_type: "percent" | "flat"
      deal_channel: "online" | "instore" | "both"
      deal_status:
        | "draft"
        | "pending_review"
        | "published"
        | "rejected"
        | "expired"
      discount_type: "percent" | "fixed" | "bogo" | "free_item"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "void"
      membership_status: "pending" | "verified" | "rejected" | "expired"
      transaction_status: "redeemed" | "expired" | "cancelled" | "disputed"
      verification_method: "id_upload" | "email_domain" | "membership_number"
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
      affiliation_type: [
        "cooperative",
        "alumni",
        "professional",
        "nysc",
        "corporate",
        "religious",
        "union",
        "other",
      ],
      app_role: ["consumer", "brand_partner", "admin"],
      brand_status: ["pending", "approved", "suspended", "rejected"],
      commission_status: ["pending", "invoiced", "paid"],
      commission_type: ["percent", "flat"],
      deal_channel: ["online", "instore", "both"],
      deal_status: [
        "draft",
        "pending_review",
        "published",
        "rejected",
        "expired",
      ],
      discount_type: ["percent", "fixed", "bogo", "free_item"],
      invoice_status: ["draft", "sent", "paid", "overdue", "void"],
      membership_status: ["pending", "verified", "rejected", "expired"],
      transaction_status: ["redeemed", "expired", "cancelled", "disputed"],
      verification_method: ["id_upload", "email_domain", "membership_number"],
    },
  },
} as const
