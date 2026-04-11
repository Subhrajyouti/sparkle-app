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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      bills: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          payment_mode: string
          store_name: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          payment_mode?: string
          store_name?: string
          total_amount?: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          payment_mode?: string
          store_name?: string
          total_amount?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          type: Database["public"]["Enums"]["category_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type?: Database["public"]["Enums"]["category_type"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["category_type"]
        }
        Relationships: []
      }
      combo_ingredients: {
        Row: {
          combo_id: string
          created_at: string
          id: string
          preprocessed_item_id: string | null
          quantity_used: number
          raw_material_id: string | null
          stage: string
        }
        Insert: {
          combo_id: string
          created_at?: string
          id?: string
          preprocessed_item_id?: string | null
          quantity_used?: number
          raw_material_id?: string | null
          stage?: string
        }
        Update: {
          combo_id?: string
          created_at?: string
          id?: string
          preprocessed_item_id?: string | null
          quantity_used?: number
          raw_material_id?: string | null
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "combo_ingredients_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combo_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_ingredients_preprocessed_item_id_fkey"
            columns: ["preprocessed_item_id"]
            isOneToOne: false
            referencedRelation: "preprocessed_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_ingredients_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      combo_menu_items: {
        Row: {
          combo_id: string
          created_at: string
          id: string
          menu_item_id: string
          quantity: number
        }
        Insert: {
          combo_id: string
          created_at?: string
          id?: string
          menu_item_id: string
          quantity?: number
        }
        Update: {
          combo_id?: string
          created_at?: string
          id?: string
          menu_item_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_menu_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combo_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_menu_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_expenses: {
        Row: {
          amount: number
          bill_id: string | null
          category: string
          created_at: string
          date: string
          description: string | null
          id: string
          payment_mode: string
          quantity_purchased: number | null
          raw_material_id: string | null
        }
        Insert: {
          amount?: number
          bill_id?: string | null
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          payment_mode?: string
          quantity_purchased?: number | null
          raw_material_id?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string | null
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          payment_mode?: string
          quantity_purchased?: number | null
          raw_material_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_expenses_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_expenses_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales: {
        Row: {
          created_at: string
          date: string
          direct_orders: number
          direct_sale: number
          id: string
          notes: string | null
          swiggy_orders: number
          swiggy_sale: number
          zomato_orders: number
          zomato_sale: number
        }
        Insert: {
          created_at?: string
          date?: string
          direct_orders?: number
          direct_sale?: number
          id?: string
          notes?: string | null
          swiggy_orders?: number
          swiggy_sale?: number
          zomato_orders?: number
          zomato_sale?: number
        }
        Update: {
          created_at?: string
          date?: string
          direct_orders?: number
          direct_sale?: number
          id?: string
          notes?: string | null
          swiggy_orders?: number
          swiggy_sale?: number
          zomato_orders?: number
          zomato_sale?: number
        }
        Relationships: []
      }
      delivery_assignment_orders: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          kitchen_order_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          kitchen_order_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          kitchen_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_assignment_orders_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "delivery_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignment_orders_kitchen_order_id_fkey"
            columns: ["kitchen_order_id"]
            isOneToOne: false
            referencedRelation: "kitchen_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_assignments: {
        Row: {
          assigned_at: string
          created_at: string
          delivered_at: string | null
          delivery_fee: number
          delivery_partner_id: string
          id: string
          notes: string | null
          payment_mode: string
          picked_up_at: string | null
          status: string
          total_cash_to_collect: number
          updated_at: string
          upi_screenshot_path: string | null
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          delivered_at?: string | null
          delivery_fee?: number
          delivery_partner_id: string
          id?: string
          notes?: string | null
          payment_mode?: string
          picked_up_at?: string | null
          status?: string
          total_cash_to_collect?: number
          updated_at?: string
          upi_screenshot_path?: string | null
        }
        Update: {
          assigned_at?: string
          created_at?: string
          delivered_at?: string | null
          delivery_fee?: number
          delivery_partner_id?: string
          id?: string
          notes?: string | null
          payment_mode?: string
          picked_up_at?: string | null
          status?: string
          total_cash_to_collect?: number
          updated_at?: string
          upi_screenshot_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_assignments_delivery_partner_id_fkey"
            columns: ["delivery_partner_id"]
            isOneToOne: false
            referencedRelation: "delivery_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_partners: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      digital_menu: {
        Row: {
          category: string
          created_at: string
          half_price: number | null
          id: string
          is_available: boolean
          name: string
          price: number
        }
        Insert: {
          category?: string
          created_at?: string
          half_price?: number | null
          id?: string
          is_available?: boolean
          name: string
          price?: number
        }
        Update: {
          category?: string
          created_at?: string
          half_price?: number | null
          id?: string
          is_available?: boolean
          name?: string
          price?: number
        }
        Relationships: []
      }
      direct_customers: {
        Row: {
          address: string | null
          avg_order_value: number | null
          created_at: string
          distance_km: number | null
          email: string | null
          gender: string | null
          id: string
          is_fan: boolean
          is_repeat: boolean
          latitude: number | null
          longitude: number | null
          name: string | null
          notes: string | null
          phone: string | null
          total_orders: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          avg_order_value?: number | null
          created_at?: string
          distance_km?: number | null
          email?: string | null
          gender?: string | null
          id?: string
          is_fan?: boolean
          is_repeat?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          total_orders?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          avg_order_value?: number | null
          created_at?: string
          distance_km?: number | null
          email?: string | null
          gender?: string | null
          id?: string
          is_fan?: boolean
          is_repeat?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          total_orders?: number
          updated_at?: string
        }
        Relationships: []
      }
      direct_order_items: {
        Row: {
          created_at: string
          id: string
          item_name: string
          menu_item_id: string | null
          order_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          menu_item_id?: string | null
          order_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          menu_item_id?: string | null
          order_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "direct_order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "direct_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_orders: {
        Row: {
          created_at: string
          customer_id: string | null
          date: string
          discount: number
          id: string
          notes: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          date?: string
          discount?: number
          id?: string
          notes?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          date?: string
          discount?: number
          id?: string
          notes?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "direct_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      item_images: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          storage_path?: string
        }
        Relationships: []
      }
      kitchen_order_items: {
        Row: {
          created_at: string
          id: string
          item_name: string
          menu_item_id: string | null
          order_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          menu_item_id?: string | null
          order_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          menu_item_id?: string | null
          order_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "digital_menu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "kitchen_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_orders: {
        Row: {
          accepted_at: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_partner_id: string | null
          id: string
          location_lat: number | null
          location_lng: number | null
          location_text: string | null
          notes: string | null
          ready_at: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          delivery_partner_id?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_text?: string | null
          notes?: string | null
          ready_at?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          delivery_partner_id?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_text?: string | null
          notes?: string | null
          ready_at?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_orders_delivery_partner_id_fkey"
            columns: ["delivery_partner_id"]
            isOneToOne: false
            referencedRelation: "delivery_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_ingredients: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string
          preprocessed_item_id: string | null
          quantity_used: number
          raw_material_id: string | null
          stage: Database["public"]["Enums"]["item_stage"]
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id: string
          preprocessed_item_id?: string | null
          quantity_used?: number
          raw_material_id?: string | null
          stage?: Database["public"]["Enums"]["item_stage"]
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string
          preprocessed_item_id?: string | null
          quantity_used?: number
          raw_material_id?: string | null
          stage?: Database["public"]["Enums"]["item_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_ingredients_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_ingredients_preprocessed_item_id_fkey"
            columns: ["preprocessed_item_id"]
            isOneToOne: false
            referencedRelation: "preprocessed_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_ingredients_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      preprocessed_item_ingredients: {
        Row: {
          created_at: string
          id: string
          ingredient_preprocessed_item_id: string | null
          preprocessed_item_id: string
          quantity_used: number
          raw_material_id: string | null
          stage: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_preprocessed_item_id?: string | null
          preprocessed_item_id: string
          quantity_used?: number
          raw_material_id?: string | null
          stage?: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_preprocessed_item_id?: string | null
          preprocessed_item_id?: string
          quantity_used?: number
          raw_material_id?: string | null
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "preprocessed_item_ingredients_ingredient_preprocessed_item_fkey"
            columns: ["ingredient_preprocessed_item_id"]
            isOneToOne: false
            referencedRelation: "preprocessed_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preprocessed_item_ingredients_preprocessed_item_id_fkey"
            columns: ["preprocessed_item_id"]
            isOneToOne: false
            referencedRelation: "preprocessed_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preprocessed_item_ingredients_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      preprocessed_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          unit: string
          yield_qty: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          unit?: string
          yield_qty?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          unit?: string
          yield_qty?: number
        }
        Relationships: []
      }
      raw_materials: {
        Row: {
          category_id: string | null
          company: string | null
          created_at: string
          id: string
          name: string
          price: number
          quantity: number
          unit: Database["public"]["Enums"]["material_unit"]
        }
        Insert: {
          category_id?: string | null
          company?: string | null
          created_at?: string
          id?: string
          name: string
          price?: number
          quantity?: number
          unit?: Database["public"]["Enums"]["material_unit"]
        }
        Update: {
          category_id?: string | null
          company?: string | null
          created_at?: string
          id?: string
          name?: string
          price?: number
          quantity?: number
          unit?: Database["public"]["Enums"]["material_unit"]
        }
        Relationships: [
          {
            foreignKeyName: "raw_materials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      zomato_pricing: {
        Row: {
          commission_pct: number
          created_at: string
          extra_cost: number
          id: string
          is_locked: boolean
          item_id: string
          item_type: string
          listed_price_override: number | null
          locked_commission: number | null
          locked_extra_cost: number | null
          locked_listed_price: number | null
          locked_profit: number | null
          locked_profit_pct: number | null
          profit_pct_override: number | null
          updated_at: string
        }
        Insert: {
          commission_pct?: number
          created_at?: string
          extra_cost?: number
          id?: string
          is_locked?: boolean
          item_id: string
          item_type?: string
          listed_price_override?: number | null
          locked_commission?: number | null
          locked_extra_cost?: number | null
          locked_listed_price?: number | null
          locked_profit?: number | null
          locked_profit_pct?: number | null
          profit_pct_override?: number | null
          updated_at?: string
        }
        Update: {
          commission_pct?: number
          created_at?: string
          extra_cost?: number
          id?: string
          is_locked?: boolean
          item_id?: string
          item_type?: string
          listed_price_override?: number | null
          locked_commission?: number | null
          locked_extra_cost?: number | null
          locked_listed_price?: number | null
          locked_profit?: number | null
          locked_profit_pct?: number | null
          profit_pct_override?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      zomato_settings: {
        Row: {
          commission_pct: number
          default_profit_pct: number
          id: string
          updated_at: string
        }
        Insert: {
          commission_pct?: number
          default_profit_pct?: number
          id?: string
          updated_at?: string
        }
        Update: {
          commission_pct?: number
          default_profit_pct?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      category_type: "ingredient" | "packaging" | "utility" | "other"
      item_stage:
        | "preparation"
        | "cooking"
        | "packaging"
        | "ingredient"
        | "utility"
        | "other"
      material_unit: "kg" | "gm" | "ml" | "litre" | "piece" | "min" | "cm"
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
      category_type: ["ingredient", "packaging", "utility", "other"],
      item_stage: [
        "preparation",
        "cooking",
        "packaging",
        "ingredient",
        "utility",
        "other",
      ],
      material_unit: ["kg", "gm", "ml", "litre", "piece", "min", "cm"],
    },
  },
} as const
