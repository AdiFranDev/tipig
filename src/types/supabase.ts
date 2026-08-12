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
      accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          created_at: string
          id: string
          is_active: boolean
          name: string
          opening_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          opening_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          opening_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          category_type: Database["public"]["Enums"]["category_type"]
          created_at: string
          default_expense_classification:
            | Database["public"]["Enums"]["expense_classification"]
            | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_type: Database["public"]["Enums"]["category_type"]
          created_at?: string
          default_expense_classification?:
            | Database["public"]["Enums"]["expense_classification"]
            | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_type?: Database["public"]["Enums"]["category_type"]
          created_at?: string
          default_expense_classification?:
            | Database["public"]["Enums"]["expense_classification"]
            | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      savings_allocations: {
        Row: {
          allocation_type: string
          amount: number
          created_at: string
          id: string
          savings_goal_id: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allocation_type: string
          amount: number
          created_at?: string
          id?: string
          savings_goal_id: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allocation_type?: string
          amount?: number
          created_at?: string
          id?: string
          savings_goal_id?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_allocations_savings_goal_id_fkey"
            columns: ["savings_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goal_balances"
            referencedColumns: ["savings_goal_id"]
          },
          {
            foreignKeyName: "savings_allocations_savings_goal_id_fkey"
            columns: ["savings_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_allocations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transaction_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_allocations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_unallocated: boolean
          name: string
          target_amount: number | null
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_unallocated?: boolean
          name: string
          target_amount?: number | null
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_unallocated?: boolean
          name?: string
          target_amount?: number | null
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scholarship_allocations: {
        Row: {
          covered_months: number
          created_at: string
          id: string
          name: string
          starting_month: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          covered_months: number
          created_at?: string
          id?: string
          name: string
          starting_month: string
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          covered_months?: number
          created_at?: string
          id?: string
          name?: string
          starting_month?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          id: string
          needs_target_percentage: number
          savings_target_percentage: number
          updated_at: string
          user_id: string
          wants_target_percentage: number
        }
        Insert: {
          created_at?: string
          id?: string
          needs_target_percentage?: number
          savings_target_percentage?: number
          updated_at?: string
          user_id: string
          wants_target_percentage?: number
        }
        Update: {
          created_at?: string
          id?: string
          needs_target_percentage?: number
          savings_target_percentage?: number
          updated_at?: string
          user_id?: string
          wants_target_percentage?: number
        }
        Relationships: []
      }
      transaction_denominations: {
        Row: {
          account_id: string
          created_at: string
          denomination: number
          direction: Database["public"]["Enums"]["denomination_direction"]
          id: string
          quantity: number
          transaction_id: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          denomination: number
          direction: Database["public"]["Enums"]["denomination_direction"]
          id?: string
          quantity: number
          transaction_id: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          denomination?: number
          direction?: Database["public"]["Enums"]["denomination_direction"]
          id?: string
          quantity?: number
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_denominations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transaction_denominations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_denominations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transaction_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_denominations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          description: string | null
          destination_account_id: string | null
          expense_classification:
            | Database["public"]["Enums"]["expense_classification"]
            | null
          funding_source: Database["public"]["Enums"]["funding_source"] | null
          id: string
          related_transaction_id: string | null
          savings_goal_id: string | null
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          destination_account_id?: string | null
          expense_classification?:
            | Database["public"]["Enums"]["expense_classification"]
            | null
          funding_source?: Database["public"]["Enums"]["funding_source"] | null
          id?: string
          related_transaction_id?: string | null
          savings_goal_id?: string | null
          transaction_date?: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          destination_account_id?: string | null
          expense_classification?:
            | Database["public"]["Enums"]["expense_classification"]
            | null
          funding_source?: Database["public"]["Enums"]["funding_source"] | null
          id?: string
          related_transaction_id?: string | null
          savings_goal_id?: string | null
          transaction_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_related_transaction_id_fkey"
            columns: ["related_transaction_id"]
            isOneToOne: false
            referencedRelation: "transaction_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_related_transaction_id_fkey"
            columns: ["related_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_savings_goal_id_fkey"
            columns: ["savings_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goal_balances"
            referencedColumns: ["savings_goal_id"]
          },
          {
            foreignKeyName: "transactions_savings_goal_id_fkey"
            columns: ["savings_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          account_type: Database["public"]["Enums"]["account_type"] | null
          balance: number | null
          is_active: boolean | null
          name: string | null
          opening_balance: number | null
          user_id: string | null
        }
        Relationships: []
      }
      denomination_balances: {
        Row: {
          account_id: string | null
          denomination: number | null
          on_hand: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_denominations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transaction_denominations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goal_balances: {
        Row: {
          is_active: boolean | null
          is_unallocated: boolean | null
          name: string | null
          saved_amount: number | null
          savings_goal_id: string | null
          target_amount: number | null
          user_id: string | null
        }
        Relationships: []
      }
      transaction_details: {
        Row: {
          account_id: string | null
          account_name: string | null
          amount: number | null
          category_id: string | null
          category_name: string | null
          created_at: string | null
          description: string | null
          destination_account_id: string | null
          destination_account_name: string | null
          expense_classification:
            | Database["public"]["Enums"]["expense_classification"]
            | null
          funding_source: Database["public"]["Enums"]["funding_source"] | null
          id: string | null
          savings_goal_id: string | null
          savings_goal_name: string | null
          transaction_date: string | null
          type: Database["public"]["Enums"]["transaction_type"] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_savings_goal_id_fkey"
            columns: ["savings_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goal_balances"
            referencedColumns: ["savings_goal_id"]
          },
          {
            foreignKeyName: "transactions_savings_goal_id_fkey"
            columns: ["savings_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      save_transaction_with_denominations: {
        Args: {
          p_account_id: string
          p_amount: number
          p_category_id: string
          p_denomination_rows?: Json
          p_description: string
          p_destination_account_id: string
          p_expense_classification: Database["public"]["Enums"]["expense_classification"]
          p_funding_source: Database["public"]["Enums"]["funding_source"]
          p_savings_goal_id: string
          p_transaction_date: string
          p_transaction_id: string
          p_type: Database["public"]["Enums"]["transaction_type"]
        }
        Returns: string
      }
    }
    Enums: {
      account_type:
        | "DIGITAL_BANK"
        | "TRADITIONAL_BANK"
        | "E_WALLET"
        | "PAPER_CASH"
        | "COIN_POUCH"
      category_type: "INCOME" | "EXPENSE"
      denomination_direction: "IN" | "OUT"
      expense_classification: "NEED" | "WANT"
      funding_source: "AVAILABLE_MONEY" | "SAVED_MONEY"
      transaction_type: "INCOME" | "EXPENSE" | "SAVINGS" | "TRANSFER"
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
      account_type: [
        "DIGITAL_BANK",
        "TRADITIONAL_BANK",
        "E_WALLET",
        "PAPER_CASH",
        "COIN_POUCH",
      ],
      category_type: ["INCOME", "EXPENSE"],
      denomination_direction: ["IN", "OUT"],
      expense_classification: ["NEED", "WANT"],
      funding_source: ["AVAILABLE_MONEY", "SAVED_MONEY"],
      transaction_type: ["INCOME", "EXPENSE", "SAVINGS", "TRANSFER"],
    },
  },
} as const
