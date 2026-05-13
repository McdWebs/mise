// Re-export DB types (hand-written until supabase gen types runs against live project)
export type { Database, AssistantMessage as DbAssistantMessage } from './database.types'
export type {
  OrderStage as DbOrderStage,
  UserRole as DbUserRole,
  MemberRole,
  AssistanceKind,
  AssistanceStatus,
} from './database.types'

// Convenience row aliases — use these throughout the app
export type OrderStage = 'received' | 'cooking' | 'ready' | 'picked_up' | 'cancelled'
export type UserRole = 'guest' | 'owner' | 'super_admin'

export interface Restaurant {
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

export interface MenuCategory {
  id: string
  restaurant_id: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface MenuItem {
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

export interface Order {
  id: string
  restaurant_id: string
  table_label: string
  stage: OrderStage
  subtotal_cents: number
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string | null
  restaurant_plan_id: string | null
  quantity: number
  modifiers: string[]
  unit_price_cents: number
  created_at: string
}

export interface AssistanceRequest {
  id: string
  restaurant_id: string
  table_label: string
  kind: 'call_server' | 'other'
  status: 'open' | 'resolved'
  created_at: string
  updated_at: string
}

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface AssistantConversation {
  id: string
  restaurant_id: string
  table_label: string
  messages_jsonb: AssistantMessage[]
  escalated: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface RestaurantMember {
  user_id: string
  restaurant_id: string
  role: 'owner' | 'staff'
}
