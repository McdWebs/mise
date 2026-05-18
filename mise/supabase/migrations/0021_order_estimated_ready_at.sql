ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS estimated_ready_at TIMESTAMPTZ;
