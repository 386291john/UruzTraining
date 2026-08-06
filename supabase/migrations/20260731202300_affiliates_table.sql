-- ============================================================
-- Migration: Create affiliates table with indexes and RLS policies
-- ============================================================

-- Create affiliates table
CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id varchar(15) NOT NULL,
  full_name varchar(100) NOT NULL,
  pin char(4) NOT NULL,
  birth_date date NOT NULL,
  phone varchar(15) NOT NULL,
  registration_date date NOT NULL DEFAULT CURRENT_DATE,
  instructor_id uuid NOT NULL REFERENCES public.profiles(id),
  observations varchar(500),
  pin_failed_attempts integer NOT NULL DEFAULT 0,
  pin_blocked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT affiliates_document_id_unique UNIQUE (document_id),
  CONSTRAINT affiliates_pin_format CHECK (pin ~ '^[0-9]{4}$'),
  CONSTRAINT affiliates_birth_date_past CHECK (birth_date <= CURRENT_DATE),
  CONSTRAINT affiliates_document_id_length CHECK (length(document_id) >= 5),
  CONSTRAINT affiliates_full_name_length CHECK (length(full_name) >= 3),
  CONSTRAINT affiliates_phone_length CHECK (length(phone) >= 7)
);

-- ============================================================
-- Indexes
-- ============================================================

-- Unique index on document_id (redundant with UNIQUE constraint but explicit for naming)
CREATE UNIQUE INDEX idx_affiliates_document_id ON public.affiliates (document_id);

-- Index on instructor_id for filtering affiliates by instructor
CREATE INDEX idx_affiliates_instructor_id ON public.affiliates (instructor_id);

-- Index on phone for lookups
CREATE INDEX idx_affiliates_phone ON public.affiliates (phone);

-- GIN trigram index on full_name for fuzzy text search
CREATE INDEX idx_affiliates_full_name_trgm ON public.affiliates USING GIN (full_name gin_trgm_ops);

-- ============================================================
-- Trigger: Auto-update updated_at on affiliate changes
-- ============================================================

CREATE TRIGGER on_affiliates_updated
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

-- SELECT: Instructor can see their own affiliates; admin can see all
CREATE POLICY "affiliates_select"
  ON public.affiliates FOR SELECT
  USING (
    instructor_id = auth.uid() OR public.is_admin()
  );

-- INSERT: Instructor can insert affiliates (auto-assigns instructor_id); admin can insert for any
CREATE POLICY "affiliates_insert"
  ON public.affiliates FOR INSERT
  WITH CHECK (
    instructor_id = auth.uid() OR public.is_admin()
  );

-- UPDATE: Instructor can update their own affiliates; admin can update all
CREATE POLICY "affiliates_update"
  ON public.affiliates FOR UPDATE
  USING (
    instructor_id = auth.uid() OR public.is_admin()
  );

-- DELETE: Only admin can delete affiliates
CREATE POLICY "affiliates_delete"
  ON public.affiliates FOR DELETE
  USING (
    public.is_admin()
  );
