-- ============================================================
-- Migration: system_config table with initial values and RLS
-- ============================================================

-- Create system_config table
CREATE TABLE IF NOT EXISTS public.system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(50) NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description varchar(200),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index on key for fast lookups
CREATE INDEX IF NOT EXISTS idx_system_config_key ON public.system_config (key);

-- Insert initial configuration values
INSERT INTO public.system_config (key, value, description) VALUES
  ('weekend_start_rule', '{"active": true}', 'Regla de inicio de vigencia en fin de semana'),
  ('notification_threshold_days', '{"days": 2}', 'Días antes del vencimiento para notificar'),
  ('notification_time', '{"hour": 6, "minute": 0}', 'Hora de ejecución diaria de notificaciones'),
  ('notification_template', '{"template": "Hola {{nombre}}, tu membresía vence el {{fecha_vencimiento}}. ¡Renueva para seguir entrenando!"}', 'Plantilla de mensaje de notificación'),
  ('login_lockout_minutes', '{"minutes": 15}', 'Minutos de bloqueo por intentos fallidos de login'),
  ('login_max_attempts', '{"attempts": 5}', 'Intentos máximos de login antes de bloqueo'),
  ('pin_lockout_minutes', '{"minutes": 15}', 'Minutos de bloqueo por intentos fallidos de PIN'),
  ('pin_max_attempts', '{"attempts": 3}', 'Intentos máximos de PIN antes de bloqueo')
ON CONFLICT (key) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Any authenticated user can read config
CREATE POLICY "Authenticated users can read system config"
  ON public.system_config
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- RLS Policy: Only admin can insert config
CREATE POLICY "Only admin can insert system config"
  ON public.system_config
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- RLS Policy: Only admin can update config
CREATE POLICY "Only admin can update system config"
  ON public.system_config
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- RLS Policy: Only admin can delete config
CREATE POLICY "Only admin can delete system config"
  ON public.system_config
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
