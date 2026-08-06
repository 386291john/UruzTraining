-- ============================================================
-- Migration: Create plans table with indices and RLS policies
-- ============================================================

-- Create plans table
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES public.profiles(id),
  name varchar(100) NOT NULL,
  allowed_days integer,
  vigency_weeks integer NOT NULL,
  price numeric(10,2) NOT NULL,
  status varchar(10) NOT NULL DEFAULT 'active',
  description varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- CHECK constraints
  CONSTRAINT chk_plans_allowed_days CHECK (allowed_days >= 1 OR allowed_days IS NULL),
  CONSTRAINT chk_plans_vigency_weeks CHECK (vigency_weeks >= 1),
  CONSTRAINT chk_plans_price CHECK (price >= 0),
  CONSTRAINT chk_plans_status CHECK (status IN ('active', 'inactive'))
);

-- ============================================================
-- Indices
-- ============================================================

CREATE INDEX idx_plans_instructor_id ON public.plans (instructor_id);
CREATE INDEX idx_plans_status ON public.plans (status);

-- ============================================================
-- Trigger: Auto-update updated_at on plan changes
-- ============================================================

CREATE TRIGGER on_plans_updated
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- SELECT: Instructor can see their own plans; admin can see all
CREATE POLICY "plans_select"
  ON public.plans FOR SELECT
  USING (
    instructor_id = auth.uid() OR public.is_admin()
  );

-- INSERT: Instructor can create plans (must be owner)
CREATE POLICY "plans_insert"
  ON public.plans FOR INSERT
  WITH CHECK (
    instructor_id = auth.uid()
  );

-- UPDATE: Instructor can update their own plans; admin can update all
CREATE POLICY "plans_update"
  ON public.plans FOR UPDATE
  USING (
    instructor_id = auth.uid() OR public.is_admin()
  );

-- DELETE: Only admin can delete plans
CREATE POLICY "plans_delete"
  ON public.plans FOR DELETE
  USING (
    public.is_admin()
  );
