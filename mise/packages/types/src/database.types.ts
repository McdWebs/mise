// Hand-written to match supabase-js v2 expected shape.
// Replace with `supabase gen types typescript` output once project is linked.

export type OrderStage = 'received' | 'cooking' | 'ready' | 'picked_up' | 'cancelled'
export type UserRole = 'guest' | 'owner' | 'super_admin'
export type MemberRole = 'owner' | 'staff'
export type AssistanceKind = 'call_server' | 'other'
export type AssistanceStatus = 'open' | 'resolved'

type Rel = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

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
        Update: {
          id?: string
          email?: string
          role?: UserRole
          created_at?: string
          updated_at?: string
        }
        Relationships: Rel[]
      }
      restaurants: {
        Row: {
          id: string
          slug: string
          name: string
          tagline: string | null
          currency: string
          accepting_orders: boolean
          suspended: boolean
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
          suspended?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          tagline?: string | null
          currency?: string
          accepting_orders?: boolean
          suspended?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: Rel[]
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
        Update: {
          user_id?: string
          restaurant_id?: string
          role?: MemberRole
        }
        Relationships: Rel[]
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
        Update: {
          id?: string
          restaurant_id?: string
          name?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'menu_items_category_id_fkey'
            columns: ['id']
            isOneToOne: false
            referencedRelation: 'menu_items'
            referencedColumns: ['category_id']
          },
        ]
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
          allergens: string[]
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
          allergens?: string[]
          image_url?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          name?: string
          description?: string | null
          price_cents?: number
          available?: boolean
          tags?: string[]
          allergens?: string[]
          image_url?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'menu_items_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'menu_categories'
            referencedColumns: ['id']
          },
        ]
      }
      restaurant_plans: {
        Row: {
          id: string
          restaurant_id: string
          title: string
          description: string | null
          price_cents: number
          includes: string[]
          active: boolean
          sort_order: number
          start_time: string | null
          end_time: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          title: string
          description?: string | null
          price_cents: number
          includes?: string[]
          active?: boolean
          sort_order?: number
          start_time?: string | null
          end_time?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          title?: string
          description?: string | null
          price_cents?: number
          includes?: string[]
          active?: boolean
          sort_order?: number
          start_time?: string | null
          end_time?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: Rel[]
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
        Update: {
          id?: string
          restaurant_id?: string
          table_label?: string
          stage?: OrderStage
          subtotal_cents?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: Rel[]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          menu_item_id: string | null
          restaurant_plan_id: string | null
          quantity: number
          modifiers: string[]
          unit_price_cents: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          menu_item_id?: string | null
          restaurant_plan_id?: string | null
          quantity: number
          modifiers?: string[]
          unit_price_cents: number
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          menu_item_id?: string | null
          restaurant_plan_id?: string | null
          quantity?: number
          modifiers?: string[]
          unit_price_cents?: number
          created_at?: string
        }
        Relationships: Rel[]
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
        Update: {
          id?: string
          restaurant_id?: string
          table_label?: string
          kind?: AssistanceKind
          status?: AssistanceStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: Rel[]
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
        Update: {
          id?: string
          restaurant_id?: string
          table_label?: string
          messages_jsonb?: AssistantMessage[]
          escalated?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: Rel[]
      }
      modifier_groups: {
        Row: {
          id: string
          menu_item_id: string
          name: string
          required: boolean
          max_selections: number | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          menu_item_id: string
          name: string
          required?: boolean
          max_selections?: number | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          menu_item_id?: string
          name?: string
          required?: boolean
          max_selections?: number | null
          sort_order?: number
          created_at?: string
        }
        Relationships: Rel[]
      }
      modifier_options: {
        Row: {
          id: string
          group_id: string
          name: string
          price_cents: number
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          name: string
          price_cents?: number
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          name?: string
          price_cents?: number
          sort_order?: number
          created_at?: string
        }
        Relationships: Rel[]
      }
      tables: {
        Row: {
          id: string
          restaurant_id: string
          label: string
          seats: number
          sort_order: number
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          label: string
          seats?: number
          sort_order?: number
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          label?: string
          seats?: number
          sort_order?: number
          active?: boolean
          created_at?: string
        }
        Relationships: Rel[]
      }
      table_status: {
        Row: {
          table_id: string
          restaurant_id: string
          waiter_name: string | null
          merged_into: string | null
          notes: string | null
          updated_at: string
          cleared_at: string | null
          occupied_since: string | null
        }
        Insert: {
          table_id: string
          restaurant_id: string
          waiter_name?: string | null
          merged_into?: string | null
          notes?: string | null
          updated_at?: string
          cleared_at?: string | null
          occupied_since?: string | null
        }
        Update: {
          table_id?: string
          restaurant_id?: string
          waiter_name?: string | null
          merged_into?: string | null
          notes?: string | null
          updated_at?: string
          cleared_at?: string | null
          occupied_since?: string | null
        }
        Relationships: Rel[]
      }
      waiter_calls: {
        Row: {
          id: string
          restaurant_id: string
          table_label: string
          called_at: string
          acknowledged_at: string | null
        }
        Insert: {
          id?: string
          restaurant_id: string
          table_label: string
          called_at?: string
          acknowledged_at?: string | null
        }
        Update: {
          id?: string
          restaurant_id?: string
          table_label?: string
          called_at?: string
          acknowledged_at?: string | null
        }
        Relationships: Rel[]
      }
      support_messages: {
        Row: {
          id: string
          restaurant_id: string
          ticket_id: string | null
          sender_role: 'owner' | 'platform'
          body: string
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          ticket_id?: string | null
          sender_role: 'owner' | 'platform'
          body: string
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          ticket_id?: string | null
          sender_role?: 'owner' | 'platform'
          body?: string
          read_at?: string | null
          created_at?: string
        }
        Relationships: Rel[]
      }
      support_tickets: {
        Row: {
          id: string
          restaurant_id: string
          topic: string
          status: 'open' | 'closed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          topic: string
          status?: 'open' | 'closed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          topic?: string
          status?: 'open' | 'closed'
          created_at?: string
          updated_at?: string
        }
        Relationships: Rel[]
      }
    }
    Views: Record<string, never>
    Functions: {
      mark_table_occupied: {
        Args: {
          p_table_id: string
          p_restaurant_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      order_stage: OrderStage
      user_role: UserRole
      member_role: MemberRole
      assistance_kind: AssistanceKind
      assistance_status: AssistanceStatus
    }
    CompositeTypes: Record<string, never>
  }
}

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}
