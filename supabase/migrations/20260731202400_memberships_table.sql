-- ============================================================
-- Migration: Create memberships table with indices and RLS policies
-- ============================================================

-- Create memberships table
CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id),
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  usage_start_date date NOT NULL,
  weeks_count_start_date date NOT NULL,
  expiration_date date NOT NULL,
  remaining_days integer,
  status varchar(15) NOT NULL DEFAULT 'active',
  days_lost integer DEFAULT 0,
  expired_detected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- CHECK constraints
  CONSTRAINT chk_memberships_remaining_days CHECK (remaining_days >= 0 OR remaining_days IS NULL),
  CONSTRAINT chk_memberships_status CHECK (status IN ('active', 'expired', 'renewed'))
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_memberships_affiliate_id ON public.memberships (affiliate_id);
CREATE INDEX idx_memberships_status ON public.memberships (status);
CREATE INDEX idx_memberships_expiration_date ON public.memberships (expiration_date);

-- ============================================================
-- Trigger: Auto-update updated_at on membership changes
-- ============================================================

CREATE TRIGGER on_memberships_updated
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- SELECT: Instructor can see memberships of their own affiliates; admin can see all
CREATE POLICY "memberships_select"
  ON public.memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = affiliate_id
        AND (a.instructor_id = auth.uid() OR public.is_admin())
    )
  );

-- INSERT: Instructor can create memberships for their own affiliates; admin can create for any
CREATE POLICY "memberships_insert"
  ON public.memberships FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = affiliate_id
        AND (a.instructor_id = auth.uid() OR public.is_admin())
    )
  );

-- UPDATE: Instructor can update memberships of their own affiliates; admin can update all
CREATE POLICY "memberships_update"
  ON public.memberships FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = affiliate_id
        AND (a.instructor_id = auth.uid() OR public.is_admin())
    )
  );

-- NO DELETE policy: Deleting memberships is prohibited
