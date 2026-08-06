-- ============================================================
-- Migration: Create entries table with UNIQUE composite constraint and RLS
-- ============================================================

-- Create entries table
CREATE TABLE public.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id),
  membership_id uuid NOT NULL REFERENCES public.memberships(id),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  entry_time timestamptz NOT NULL DEFAULT now(),
  registered_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate entries per affiliate per day
  CONSTRAINT uq_entries_affiliate_date UNIQUE (affiliate_id, entry_date)
);

-- ============================================================
-- Indexes
-- ============================================================

-- UNIQUE composite index (created implicitly by the UNIQUE constraint above)
-- Named explicitly for documentation: idx_entries_affiliate_date

-- Index on entry_date for date-range queries (reports)
CREATE INDEX idx_entries_entry_date ON public.entries (entry_date);

-- Index on registered_by for filtering by instructor
CREATE INDEX idx_entries_registered_by ON public.entries (registered_by);

-- ============================================================
-- Enable Row Level Security
-- ============================================================

ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies
-- ============================================================

-- SELECT: Users can view entries for affiliates they own (instructor) or all (admin)
CREATE POLICY "entries_select"
  ON public.entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = affiliate_id
        AND (a.instructor_id = auth.uid() OR public.is_admin())
    )
  );

-- INSERT: Authenticated user must be the one registering the entry, or admin
CREATE POLICY "entries_insert"
  ON public.entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    registered_by = auth.uid() OR public.is_admin()
  );

-- NO UPDATE policy (prohibited)
-- NO DELETE policy (prohibited)
