-- =============================================================================
-- CARGA MASIVA DE AFILIADOS - UruzTraining
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Primero asegúrate de que los planes existen en la tabla `plans`
-- 2. Copia un bloque por cada afiliado y llena los datos
-- 3. Ejecuta todo el script en Supabase SQL Editor
--
-- DATOS NECESARIOS POR AFILIADO:
-- - document_id: Cédula (5-15 dígitos)
-- - full_name: Nombre completo
-- - pin: PIN de 4 dígitos
-- - birth_date: Fecha nacimiento (YYYY-MM-DD)
-- - phone: Celular (7-15 dígitos)
-- - plan_id: UUID del plan (ver lista abajo)
-- - remaining_days: Días que le QUEDAN por consumir
-- - expiration_date: Fecha en que vence su plan actual (YYYY-MM-DD)
-- - clases_consumidas: Número de clases/ingresos ya registrados
-- - observations: Notas opcionales
--
-- PLANES DISPONIBLES:
-- Plan "8 Dias" → ID: 7353b455-a869-4ddc-a2b7-e4fe031649d0 (8 días, 2 semanas)
--
-- INSTRUCTOR ID: 9ae488a0-837f-4828-bb35-ee5cf841e508
-- =============================================================================

DO $$
DECLARE
  v_instructor_id UUID := '9ae488a0-837f-4828-bb35-ee5cf841e508';
  v_affiliate_id UUID;
  v_membership_id UUID;
  v_plan_id UUID;
  v_today DATE := CURRENT_DATE;
BEGIN

  -- ═══════════════════════════════════════════════════════════════════════════
  -- AFILIADO 1: (copia este bloque para cada afiliado)
  -- ═══════════════════════════════════════════════════════════════════════════
  v_plan_id := '7353b455-a869-4ddc-a2b7-e4fe031649d0'; -- Plan "8 Dias"

  INSERT INTO affiliates (document_id, full_name, pin, birth_date, phone, instructor_id, observations)
  VALUES (
    '1234567890',           -- document_id (cédula)
    'NOMBRE COMPLETO',      -- full_name
    '1234',                 -- pin (4 dígitos)
    '1990-01-15',           -- birth_date (YYYY-MM-DD)
    '3001234567',           -- phone (celular)
    v_instructor_id,        -- instructor
    NULL                    -- observations (opcional)
  )
  RETURNING id INTO v_affiliate_id;

  INSERT INTO memberships (affiliate_id, plan_id, usage_start_date, weeks_count_start_date, expiration_date, remaining_days, status)
  VALUES (
    v_affiliate_id,
    v_plan_id,
    v_today,                -- usage_start_date (fecha inicio uso)
    v_today,                -- weeks_count_start_date (fecha inicio conteo semanas)
    '2026-08-20',           -- expiration_date (fecha vencimiento del plan)
    5,                      -- remaining_days (días que le QUEDAN)
    'active'
  )
  RETURNING id INTO v_membership_id;

  -- Registrar clases ya consumidas (opcional: si ya tiene ingresos previos)
  -- Descomenta y ajusta las fechas según los días que ya asistió:
  -- INSERT INTO entries (affiliate_id, membership_id, entry_date, entry_time, registered_by)
  -- VALUES
  --   (v_affiliate_id, v_membership_id, '2026-08-01', NOW(), v_instructor_id),
  --   (v_affiliate_id, v_membership_id, '2026-08-02', NOW(), v_instructor_id),
  --   (v_affiliate_id, v_membership_id, '2026-08-04', NOW(), v_instructor_id);


  -- ═══════════════════════════════════════════════════════════════════════════
  -- AFILIADO 2: (ejemplo)
  -- ═══════════════════════════════════════════════════════════════════════════
  -- v_plan_id := '7353b455-a869-4ddc-a2b7-e4fe031649d0';
  --
  -- INSERT INTO affiliates (document_id, full_name, pin, birth_date, phone, instructor_id, observations)
  -- VALUES ('9876543210', 'OTRO USUARIO', '5678', '1985-06-20', '3109876543', v_instructor_id, NULL)
  -- RETURNING id INTO v_affiliate_id;
  --
  -- INSERT INTO memberships (affiliate_id, plan_id, usage_start_date, weeks_count_start_date, expiration_date, remaining_days, status)
  -- VALUES (v_affiliate_id, v_plan_id, v_today, v_today, '2026-08-25', 3, 'active')
  -- RETURNING id INTO v_membership_id;

END $$;
