-- ============================================================
-- Migration: Create notifications table with UNIQUE constraint and RLS
-- ============================================================

-- Create notifications table for tracking sent notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id),
  membership_id uuid NOT NULL REFERENCES public.memberships(id),
  notification_type varchar(30) NOT NULL DEFAULT 'expiration_reminder',
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  phone_used varchar(15),
  error_message text,
  external_message_id varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Indices
-- ============================================================

-- UNIQUE composite index: prevents duplicate notifications per affiliate/membership/type
CREATE UNIQUE INDEX idx_notifications_affiliate_membership
  ON public.notifications (affiliate_id, membership_id, notification_type);

-- Index on status for filtering pending/failed notifications
CREATE INDEX idx_notifications_status
  ON public.notifications (status);

-- ============================================================
-- Trigger: Auto-update updated_at on notification changes
-- ============================================================

CREATE TRIGGER on_notifications_updated
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: Only admin users can view notifications
CREATE POLICY "notifications_select"
  ON public.notifications FOR SELECT
  USING (public.is_admin());

-- INSERT/UPDATE: No policies for regular users.
-- The service_role client (admin.ts) bypasses RLS entirely,
-- so notification creation and updates are handled server-side only.

-- DELETE: No policy — deletions are not allowed for any role through RLS.
