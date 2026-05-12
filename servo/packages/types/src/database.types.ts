// Hand-written until `supabase gen types typescript` can be run against a live project.
// Keep in sync with supabase/migrations/0001_init.sql.

export type OrderStage = 'received' | 'cooking' | 'ready' | 'picked_up' | 'cancelled'
export type UserRole = 'guest' | 'owner' | 'super_admin'
export type MemberRole = 'owner' | 'staff'
export type AssistanceKind = 'call_server' | 'other'
export type AssistanceStatus = 'open' | 'resolved'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          role: UserRole
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: UserRole
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }

      restaurants: {
        Row: {
          id: string
          slug: string
          name: string
          tagline: string | null
          currency: string
          accepting_orders: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          tagline?: string | null
          currency?: string
          accepting_orders?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['restaurants']['Insert']>
      }

      restaurant_members: {
        Row: {
          user_id: string
          restaurant_id: string
          role: MemberRole
        }
        Insert: {
          user_id: string
          restaurant_id: string
          role?: MemberRole
        }
        Update: Partial<Database['public']['Tables']['restaurant_members']['Insert']>
      }

      menu_categories: {
        Row: {
          id: string
          restaurant_id: string
          name: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          name: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['menu_categories']['Insert']>
      }

      menu_items: {
        Row: {
          id: string
          category_id: string
          name: string
          description: string | null
          price_cents: number
          available: boolean
          tags: string[]
          image_url: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id: string
          name: string
          description?: string | null
          price_cents: number
          available?: boolean
          tags?: string[]
          image_url?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['menu_items']['Insert']>
      }

      orders: {
        Row: {
          id: string
          restaurant_id: string
          table_label: string
          stage: OrderStage
          subtotal_cents: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          table_label: string
          stage?: OrderStage
          subtotal_cents: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }

      order_items: {
        Row: {
          id: string
          order_id: string
          menu_item_id: string
          quantity: number
          modifiers: string[]
          unit_price_cents: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          menu_item_id: string
          quantity: number
          modifiers?: string[]
          unit_price_cents: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>
      }

      assistance_requests: {
        Row: {
          id: string
          restaurant_id: string
          table_label: string
          kind: AssistanceKind
          status: AssistanceStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          table_label: string
          kind?: AssistanceKind
          status?: AssistanceStatus
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['assistance_requests']['Insert']>
      }

      assistant_conversations: {
        Row: {
          id: string
          restaurant_id: string
          table_label: string
          messages_jsonb: AssistantMessage[]
          escalated: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          table_label: string
          messages_jsonb?: AssistantMessage[]
          escalated?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['assistant_conversations']['Insert']>
      }
    }
  }
}

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}
