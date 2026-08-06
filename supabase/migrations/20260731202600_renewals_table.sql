-- ============================================================
-- Migration: Create renewals table (immutable) with RLS policies
-- ============================================================

-- Create renewals table (immutable - no UPDATE or DELETE allowed)
CREATE TABLE public.renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id),
  previous_plan_id uuid NOT NULL REFERENCES public.plans(id),
  new_plan_id uuid NOT NULL REFERENCES public.plans(id),
  previous_membership_id uuid NOT NULL REFERENCES public.memberships(id),
  new_membership_id uuid NOT NULL REFERENCES public.memberships(id),
  renewal_date timestamptz NOT NULL DEFAULT now(),
  performed_by uuid NOT NULL REFERENCES public.profiles(id),
  unused_days integer NOT NULL DEFAULT 0,
  observations varchar(500),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

-- Index on affiliate_id for filtering renewals by affiliate
CREATE INDEX idx_renewals_affiliate_id ON public.renewals (affiliate_id);

-- Index on renewal_date for date-based queries
CREATE INDEX idx_renewals_renewal_date ON public.renewals (renewal_date);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.renewals ENABLE ROW LEVEL SECURITY;

-- SELECT: Instructor can see renewals of their own affiliates; admin can see all
CREATE POLICY "renewals_select"
  ON public.renewals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = affiliate_id
      AND (a.instructor_id = auth.uid() OR public.is_admin())
    )
  );

-- INSERT: Authenticated user can insert if they are the performer or admin
CREATE POLICY "renewals_insert"
  ON public.renewals FOR INSERT
  WITH CHECK (
    performed_by = auth.uid() OR public.is_admin()
  );

-- NO UPDATE policy — table is immutable
-- NO DELETE policy — table is immutable
