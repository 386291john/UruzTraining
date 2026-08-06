# Implementation Plan: Gestión de Membresías de Gimnasio (UruzTraining)

## Overview

Implementación modular del sistema UruzTraining siguiendo el orden: Setup → Base de datos → Autenticación → Planes → Afiliados → Control de Ingreso → Renovaciones → Notificaciones → Tablero → Informes → Configuración → Testing de propiedades. Cada módulo incluye backend (API routes + servicios + repositorios), frontend (componentes + hooks) y validaciones.

## Tasks

- [x] 1. Configuración del proyecto y estructura base
  - [x] 1.1 Inicializar proyecto Next.js 14 con App Router y dependencias principales
    - Ejecutar `npx create-next-app@14` con TypeScript, Tailwind CSS, App Router
    - Instalar dependencias: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `lucide-react`, `date-fns`
    - Instalar dependencias de desarrollo: `vitest`, `fast-check`, `@testing-library/react`, `msw`
    - Configurar `tsconfig.json` con path aliases (`@/`)
    - _Requisitos: 13.1, 13.4, 13.6_

  - [x] 1.2 Configurar Shadcn UI e instalar componentes base
    - Inicializar Shadcn UI con `npx shadcn-ui@latest init`
    - Instalar componentes: Button, Input, Card, Dialog, Table, Form, Toast, Select, Badge, Tabs, DropdownMenu
    - Configurar tema claro como default con soporte para dark mode
    - _Requisitos: 13.4, 13.2, 13.6_

  - [x] 1.3 Crear estructura de carpetas y archivos base del proyecto
    - Crear estructura: `src/lib/supabase/`, `src/lib/types/`, `src/lib/validators/`, `src/lib/utils/`
    - Crear estructura: `src/services/`, `src/repositories/`, `src/hooks/`, `src/components/`
    - Crear `src/lib/utils/constants.ts` con constantes del sistema
    - Crear `src/lib/supabase/client.ts` (cliente browser), `src/lib/supabase/server.ts` (cliente server), `src/lib/supabase/admin.ts` (service-role)
    - _Requisitos: 12.2_

  - [x] 1.4 Configurar Vitest y estructura de tests
    - Crear `vitest.config.ts` con soporte para TypeScript y path aliases
    - Crear estructura: `tests/unit/`, `tests/properties/`, `tests/integration/`, `tests/generators/`
    - Configurar scripts en `package.json`: `test`, `test:unit`, `test:properties`
    - _Requisitos: Soporte testing_

- [x] 2. Esquema de base de datos (migraciones via Supabase MCP)
  - [x] 2.1 Crear migración de funciones auxiliares RLS y extensiones
    - Habilitar extensión `pg_trgm` para búsqueda por trigrama
    - Crear función `get_user_role()` que retorna el rol del usuario autenticado
    - Crear función `is_admin()` que verifica si el usuario es administrador
    - Aplicar migración via Supabase MCP (`apply_migration`)
    - _Requisitos: 12.1_

  - [x] 2.2 Crear migración de tabla `profiles` con trigger y políticas RLS
    - Crear tabla `profiles` (id uuid PK FK→auth.users, full_name, role, avatar_url, created_at, updated_at)
    - Crear trigger para crear perfil automáticamente al registrarse un usuario en auth.users
    - Habilitar RLS: SELECT propio perfil o admin ve todos; UPDATE solo propio perfil
    - Aplicar migración via Supabase MCP
    - _Requisitos: 1.3, 12.1_

  - [x] 2.3 Crear migración de tabla `plans` con índices y políticas RLS
    - Crear tabla `plans` con CHECK constraints (allowed_days >= 1 OR NULL, vigency_weeks >= 1, price >= 0)
    - Crear índices: `idx_plans_instructor_id`, `idx_plans_status`
    - Habilitar RLS: SELECT instructor solo sus planes / admin todos; INSERT instructor (owner auto); UPDATE instructor propios / admin todos; DELETE solo admin
    - Aplicar migración via Supabase MCP
    - _Requisitos: 2.1, 2.3, 2.4, 2.5, 2.6, 2.9, 2.10, 12.1_

  - [x] 2.4 Crear migración de tabla `affiliates` con índices y políticas RLS
    - Crear tabla `affiliates` con UNIQUE(document_id), CHECK constraints (pin ~ '^[0-9]{4}$', birth_date <= CURRENT_DATE, length(document_id) >= 5, length(full_name) >= 3, length(phone) >= 7)
    - Crear índices: UNIQUE `idx_affiliates_document_id`, `idx_affiliates_instructor_id`, `idx_affiliates_phone`, GIN `idx_affiliates_full_name_trgm`
    - Habilitar RLS: SELECT instructor sus afiliados / admin todos; INSERT instructor (auto-asigna); UPDATE instructor propios / admin todos; DELETE solo admin
    - Aplicar migración via Supabase MCP
    - _Requisitos: 3.1, 3.2, 3.3, 3.5, 4.4, 4.5, 12.1_

  - [x] 2.5 Crear migración de tabla `memberships` con índices y políticas RLS
    - Crear tabla `memberships` con campos: usage_start_date, weeks_count_start_date, expiration_date, remaining_days (NULLABLE para ilimitado), status, days_lost, expired_detected_at
    - CHECK constraints: remaining_days >= 0 OR NULL, status IN ('active', 'expired', 'renewed')
    - Crear índices: `idx_memberships_affiliate_id`, `idx_memberships_status`, `idx_memberships_expiration_date`
    - Habilitar RLS: SELECT/INSERT/UPDATE via join con affiliates (instructor propios / admin todos); DELETE prohibido
    - Aplicar migración via Supabase MCP
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 14.1, 14.2, 12.1_

  - [x] 2.6 Crear migración de tabla `entries` con constraint UNIQUE compuesto y políticas RLS
    - Crear tabla `entries` con UNIQUE(affiliate_id, entry_date) para prevenir duplicados diarios
    - Crear índices: `idx_entries_affiliate_date` (UNIQUE composite), `idx_entries_entry_date`, `idx_entries_registered_by`
    - Habilitar RLS: SELECT via join con affiliates; INSERT registrado por el usuario autenticado; UPDATE/DELETE prohibidos
    - Aplicar migración via Supabase MCP
    - _Requisitos: 6.6, 6.1, 12.1_

  - [x] 2.7 Crear migración de tabla `renewals` (inmutable) con políticas RLS
    - Crear tabla `renewals` con FKs a affiliates, plans (previous/new), memberships (previous/new), profiles (performed_by)
    - Incluir campo `unused_days` para registrar días no utilizados del plan anterior
    - Habilitar RLS: SELECT via join con affiliates; INSERT usuario autenticado; UPDATE/DELETE prohibidos (tabla inmutable)
    - Crear índices: `idx_renewals_affiliate_id`, `idx_renewals_renewal_date`
    - Aplicar migración via Supabase MCP
    - _Requisitos: 8.4, 8.5, 12.1_

  - [x] 2.8 Crear migración de tabla `notifications` con constraint UNIQUE compuesto y políticas RLS
    - Crear tabla `notifications` con UNIQUE(affiliate_id, membership_id, notification_type) para prevenir duplicados por período
    - Campos: status (pending/sent/delivered/failed/skipped), attempts, last_attempt_at, next_retry_at, error_message, external_message_id
    - Habilitar RLS: SELECT solo admin; INSERT/UPDATE solo service role; DELETE prohibido
    - Crear índices: `idx_notifications_affiliate_membership` (UNIQUE composite), `idx_notifications_status`
    - Aplicar migración via Supabase MCP
    - _Requisitos: 9.3, 9.6, 12.1_

  - [x] 2.9 Crear migración de tabla `system_config` con valores iniciales
    - Crear tabla `system_config` con UNIQUE(key), campo value tipo JSONB
    - Insertar valores iniciales: weekend_start_rule, notification_threshold_days, notification_time, notification_template, login_lockout_minutes, login_max_attempts, pin_lockout_minutes, pin_max_attempts
    - Habilitar RLS: SELECT cualquier usuario autenticado; INSERT/UPDATE/DELETE solo admin
    - Aplicar migración via Supabase MCP
    - _Requisitos: 5.5, 9.1, 9.4, 1.7, 6.3, 12.1_

  - [x] 2.10 Generar tipos TypeScript desde el esquema de Supabase
    - Ejecutar `npx supabase gen types typescript --project-id thcyjxnkcvpptdpbvqez > src/lib/types/database.ts`
    - Crear `src/lib/types/domain.ts` con tipos de dominio extendidos (MembershipStatus, VigencyCalculationInput, EntryValidationResult, etc.)
    - Crear `src/lib/types/api.ts` con tipos de request/response (ApiErrorResponse, ApiSuccessResponse, PaginatedResult)
    - _Requisitos: 12.3_

- [x] 3. Punto de control - Verificar esquema de base de datos
  - Asegurar que todas las migraciones se aplicaron correctamente, preguntar al usuario si surgen dudas.

- [x] 4. Módulo de Autenticación
  - [x] 4.1 Implementar middleware de autenticación de Next.js
    - Crear `src/middleware.ts` que intercepte todas las rutas protegidas bajo `/(dashboard)`
    - Verificar sesión usando `@supabase/ssr` con cookies httpOnly
    - Redirigir a `/login` si no hay sesión válida o sesión expirada (con mensaje de expiración)
    - Permitir acceso libre a rutas bajo `/(auth)`
    - _Requisitos: 1.5, 1.6_

  - [x] 4.2 Implementar servicio de autenticación con bloqueo por intentos fallidos
    - Crear `src/services/auth.service.ts` con lógica de login, logout, verificación de sesión
    - Implementar contador de intentos fallidos con bloqueo de 15 minutos tras 5 intentos (valores desde system_config)
    - Retornar error genérico sin revelar cuál campo es incorrecto
    - _Requisitos: 1.1, 1.2, 1.7_

  - [x] 4.3 Implementar API Route Handler de autenticación
    - Crear `src/app/api/auth/login/route.ts` (POST: email + password → signInWithPassword)
    - Crear `src/app/api/auth/logout/route.ts` (POST: cierre de sesión)
    - Crear `src/app/api/auth/session/route.ts` (GET: sesión actual con rol)
    - Validar input con Zod en cada endpoint
    - _Requisitos: 1.1, 1.2_

  - [x] 4.4 Implementar página de login y hook useAuth
    - Crear `src/app/(auth)/login/page.tsx` con formulario de email + contraseña usando Shadcn UI
    - Crear `src/hooks/use-auth.ts` con estado de usuario, rol, login, logout, isLoading, error
    - Mostrar feedback de error genérico y estado de bloqueo temporal
    - Redirigir al Tablero tras login exitoso (máximo 3 segundos)
    - _Requisitos: 1.1, 1.2, 1.7, 13.4, 13.7_

  - [x] 4.5 Implementar control de acceso basado en roles (admin/instructor)
    - Crear componente `RoleGuard` que condicione renderizado según rol
    - Crear utilidad `checkPermission(role, action)` para verificar permisos en Route Handlers
    - Impedir acceso a operaciones de eliminación para Instructores (retornar 403)
    - _Requisitos: 1.3, 1.4_

  - [x] 4.6 Implementar layout de dashboard con sidebar, header y tema
    - Crear `src/app/(dashboard)/layout.tsx` con sidebar de navegación y header
    - Implementar `src/components/layout/sidebar.tsx` con iconos Lucide y navegación por módulos
    - Implementar `src/components/layout/header.tsx` con info de usuario y toggle de tema oscuro/claro
    - Crear `src/hooks/use-theme.ts` para persistir preferencia de tema en localStorage
    - Diseño responsivo: sidebar colapsable en móvil, sticky header
    - _Requisitos: 13.1, 13.2, 13.3, 13.5_

- [x] 5. Módulo de Planes
  - [x] 5.1 Implementar repositorio y servicio de planes
    - Crear `src/repositories/plan.repository.ts` con operaciones CRUD usando cliente Supabase autenticado (RLS aplica automáticamente)
    - Crear `src/services/plan.service.ts` con lógica de negocio: creación, actualización, validación de pertenencia, verificación de afiliados activos antes de eliminar
    - Crear `src/lib/validators/plan.validator.ts` con esquema Zod: nombre (max 100), allowed_days (>=1 o null), vigency_weeks (>=1), price (>=0), status, description (max 500)
    - _Requisitos: 2.1, 2.2, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [x] 5.2 Implementar API Route Handlers de planes
    - Crear `src/app/api/plans/route.ts` (GET: listar planes filtrados por RLS; POST: crear plan)
    - Crear `src/app/api/plans/[id]/route.ts` (GET: detalle; PUT: actualizar; DELETE: eliminar solo admin)
    - Validar datos de entrada con Zod en servidor, retornar errores específicos por campo
    - Retornar 403 si instructor intenta modificar plan ajeno, 409 si intenta eliminar con afiliados activos
    - _Requisitos: 2.1, 2.5, 2.6, 2.7, 2.9, 2.10, 12.3_

  - [x] 5.3 Implementar componentes UI de planes (formulario y listado)
    - Crear `src/components/plans/plan-form.tsx` con formulario de creación/edición usando Shadcn UI Form + Zod resolver
    - Crear `src/components/plans/plan-list.tsx` con tabla de planes, badge de estado, acciones (editar, desactivar, eliminar)
    - Crear `src/hooks/use-plans.ts` con operaciones CRUD, loading y manejo de errores
    - Crear `src/app/(dashboard)/plans/page.tsx` y `src/app/(dashboard)/plans/[id]/page.tsx`
    - Campo "ilimitado" como checkbox que deshabilita el campo de días permitidos (allowed_days = null)
    - _Requisitos: 2.1, 2.3, 2.4, 2.7, 2.8, 13.4_

- [x] 6. Módulo de Afiliados
  - [x] 6.1 Implementar servicio de cálculo de vigencia (VigencyService)
    - Crear `src/services/vigency.service.ts` con función pura `calculateVigency(input)` que retorna: usageStartDate, weeksCountStartDate, expirationDate
    - Implementar lógica: Lun-Jue → ambas fechas = fecha adquisición; Vie-Dom con regla activa → uso desde adquisición, conteo desde lunes; Vie-Dom sin regla → ambas = adquisición
    - Fórmula vencimiento: weeksCountStartDate + (vigencyWeeks × 7) - 1 día
    - Crear funciones auxiliares: `isExpired()`, `getDaysUntilExpiration()`
    - _Requisitos: 5.1, 5.2, 5.3, 5.4_

  - [x]* 6.2 Escribir test de propiedad para cálculo de vigencia
    - **Property 1: Cálculo de vigencia correcto**
    - Generar fechas aleatorias (cubriendo Lun-Dom), planes con vigencyWeeks (1-52), y estado de regla (activo/inactivo)
    - Verificar: (a) Lun-Jue → usage=weeks_count=acquisition; (b) Vie-Dom + regla activa → usage=acquisition, weeks_count=siguiente lunes; (c) Vie-Dom + regla inactiva → usage=weeks_count=acquisition; (d) expiration = weeks_count + (weeks×7) - 1
    - Crear generador `tests/generators/date.generator.ts` y `tests/generators/plan.generator.ts`
    - **Valida: Requisitos 5.1, 5.2, 5.3, 5.4, 5.7**

  - [x] 6.3 Implementar repositorio y servicio de afiliados
    - Crear `src/repositories/affiliate.repository.ts` con operaciones CRUD, búsqueda parcial por document_id, nombre (trigram), y teléfono
    - Crear `src/services/affiliate.service.ts` con lógica: registro (auto-asigna instructor, fecha actual, calcula vigencia), actualización de PIN, verificación de duplicado por document_id
    - Crear `src/repositories/membership.repository.ts` con operaciones para membresías
    - Crear `src/lib/validators/affiliate.validator.ts` con esquema Zod: document_id (5-15 numérico), full_name (3-100), pin (4 dígitos), birth_date (no futura), phone (7-15 dígitos), observations (max 500)
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [x]* 6.4 Escribir test de propiedad para validación de PIN
    - **Property 2: Validación de PIN**
    - Generar cadenas aleatorias de longitud variable (0-10) con caracteres alfanuméricos y especiales
    - Verificar que SOLO cadenas de exactamente 4 dígitos numéricos (0000-9999) pasan la validación
    - **Valida: Requisitos 3.3, 7.2**

  - [x]* 6.5 Escribir test de propiedad para unicidad de documento de identidad
    - **Property 7: Unicidad de documento de identidad**
    - Generar document_ids duplicados y verificar que el segundo intento de registro es rechazado y el registro original no se modifica
    - Crear generador `tests/generators/affiliate.generator.ts`
    - **Valida: Requisitos 3.2**

  - [x]* 6.6 Escribir test de propiedad para validación de entrada (datos inválidos)
    - **Property 15: Validación de entrada rechaza datos inválidos con errores específicos**
    - Generar datos de afiliado con campos inválidos (nombre vacío, document_id fuera de rango, fecha futura, etc.)
    - Verificar que cada violación produce un error específico mencionando el campo y la regla violada
    - **Valida: Requisitos 2.7, 3.6**

  - [x] 6.7 Implementar API Route Handlers de afiliados
    - Crear `src/app/api/affiliates/route.ts` (GET: búsqueda con query params search, field, page; POST: registro)
    - Crear `src/app/api/affiliates/[id]/route.ts` (GET: perfil completo con membresía activa; PUT: actualizar; DELETE: solo admin)
    - Crear `src/app/api/affiliates/[id]/pin/route.ts` (PUT: actualizar PIN con validación 4 dígitos)
    - Validación server-side con Zod; retornar 409 para documento duplicado; 400 para datos inválidos
    - _Requisitos: 3.1, 3.2, 3.6, 4.1, 4.2, 4.3, 4.6, 4.7, 4.8, 7.1, 7.2, 7.3, 7.4, 12.3_

  - [x] 6.8 Implementar componentes UI de afiliados (búsqueda, registro, perfil)
    - Crear `src/components/affiliates/affiliate-search.tsx` con campos de búsqueda por documento, nombre y celular (mínimo 3 caracteres)
    - Crear `src/components/affiliates/affiliate-form.tsx` con formulario de registro usando Shadcn UI, selector de plan activo
    - Crear `src/components/affiliates/affiliate-profile.tsx` con vista de perfil, membresía activa, historial y botón de renovación
    - Crear `src/hooks/use-affiliates.ts` con búsqueda paginada (max 20 por página), registro, actualización de PIN
    - Crear páginas: `src/app/(dashboard)/affiliates/page.tsx`, `new/page.tsx`, `[id]/page.tsx`
    - _Requisitos: 3.1, 3.8, 4.1, 4.2, 4.3, 4.6, 4.7, 4.8, 7.1, 13.4_

  - [x]* 6.9 Escribir test de propiedad para correctitud de búsqueda
    - **Property 6: Correctitud de búsqueda por campo**
    - Generar términos de búsqueda de 3+ caracteres y conjuntos de afiliados con datos aleatorios
    - Verificar que TODOS los resultados retornados contienen el término como subcadena en el campo correspondiente (case-insensitive para nombre)
    - **Valida: Requisitos 4.1, 4.2, 4.3**

  - [x]* 6.10 Escribir test de propiedad para paginación y búsqueda corta
    - **Property 17: Paginación no excede tamaño máximo**
    - Generar conjuntos de resultados de búsqueda y verificar que cada página contiene máximo 20 registros
    - **Property 18: Búsqueda rechaza términos cortos**
    - Generar términos de búsqueda con longitud < 3 y verificar que el sistema rechaza con error de validación
    - **Valida: Requisitos 4.6, 4.8**

- [x] 7. Punto de control - Verificar módulos base
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 8. Módulo de Control de Ingreso
  - [x] 8.1 Implementar servicio de control de ingreso (EntryService)
    - Crear `src/services/entry.service.ts` con método `validateAndRegisterEntry(documentId, pin)`
    - Implementar orden de prioridad de validación: (1) existencia afiliado → (2) PIN bloqueado → (3) PIN coincide → (4) membresía vigente → (5) días restantes → (6) duplicado diario
    - Implementar lógica de bloqueo: incrementar intentos fallidos, bloquear 15 min tras 3 intentos, resetear al éxito
    - Descontar día del plan al registrar ingreso (excepto planes ilimitados con remaining_days = NULL)
    - Crear `src/repositories/entry.repository.ts` con operaciones de ingreso y verificación de duplicado diario
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x]* 8.2 Escribir test de propiedad para orden de prioridad de validación de ingreso
    - **Property 3: Orden de prioridad en validación de ingreso**
    - Generar combinaciones de condiciones de falla simultáneas (afiliado no existe + PIN incorrecto + membresía vencida, etc.)
    - Verificar que el sistema SIEMPRE retorna el error de mayor prioridad según el orden definido
    - Crear generador `tests/generators/entry-attempt.generator.ts`
    - **Valida: Requisitos 6.8, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

  - [x]* 8.3 Escribir test de propiedad para expiración dual de membresía
    - **Property 13: Expiración dual de membresía**
    - Generar membresías con diferentes combinaciones de remaining_days y expiration_date
    - Verificar: plan limitado inválido si days=0 O fecha>expiration (más restrictivo bloquea); plan ilimitado inválido solo si fecha>expiration; cuando vence por tiempo con days>0, days_lost = remaining_days
    - Crear generador `tests/generators/membership.generator.ts`
    - **Valida: Requisitos 14.1, 14.2, 14.3, 14.4**

  - [x]* 8.4 Escribir test de propiedad para prevención de ingreso duplicado
    - **Property 8: Prevención de ingreso duplicado por día**
    - Generar afiliados con ingreso previo en una fecha D y verificar que un segundo intento en la misma fecha es rechazado con error de duplicidad
    - **Valida: Requisitos 6.6**

  - [x]* 8.5 Escribir test de propiedad para bloqueo por intentos fallidos
    - **Property 14: Bloqueo por intentos fallidos**
    - Generar secuencias de intentos fallidos de PIN (1 a 5 intentos) y verificar que al alcanzar el umbral (3) se bloquea durante 15 minutos
    - Verificar que intentos exitosos previos resetean el contador
    - **Valida: Requisitos 1.7, 6.3**

  - [x] 8.6 Implementar API Route Handler de control de ingreso
    - Crear `src/app/api/entry/route.ts` (POST: body con document_id + pin)
    - Validar input con Zod, delegar a EntryService
    - Retornar respuesta con nombre, plan, días restantes (post-descuento), fecha vencimiento; o error con código apropiado
    - Códigos HTTP: 200 éxito, 400 validación, 404 no encontrado, 429 bloqueado, 409 duplicado
    - _Requisitos: 6.1, 6.7, 14.4_

  - [x] 8.7 Implementar componentes UI de control de ingreso
    - Crear `src/components/entry/entry-form.tsx` con campos Documento_ID + PIN usando Shadcn UI
    - Crear `src/components/entry/entry-result.tsx` con vista de bienvenida (nombre, plan, días restantes, vencimiento) o mensaje de error con código visual diferenciado
    - Crear `src/hooks/use-entry.ts` con estado de procesamiento y último resultado
    - Crear `src/app/(dashboard)/entry/page.tsx`
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 13.4, 14.4_

- [x] 9. Módulo de Renovaciones
  - [x] 9.1 Implementar servicio de renovación (MembershipService.renew)
    - Crear `src/services/renewal.service.ts` con método `renew(input)` que: marque membresía anterior como 'renewed', cree nueva membresía con vigencia calculada (VigencyService), registre renovación con datos históricos
    - Crear `src/repositories/renewal.repository.ts` con INSERT (sin UPDATE ni DELETE)
    - Calcular unused_days del plan anterior, reiniciar remaining_days con el nuevo plan
    - Permitir cambio de instructor responsable durante renovación
    - Rechazar si el plan seleccionado está inactivo
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [-]* 9.2 Escribir test de propiedad para completitud e inmutabilidad de renovaciones
    - **Property 9: Completitud e inmutabilidad de renovaciones**
    - Generar renovaciones y verificar que cada una produce un registro con: plan anterior, plan nuevo, fecha, instructor, días no utilizados, observaciones
    - Verificar que cualquier intento de UPDATE o DELETE sobre un registro de renovación es rechazado
    - **Valida: Requisitos 8.4, 8.5**

  - [-]* 9.3 Escribir test de propiedad para renovación con parámetros del nuevo plan
    - **Property 10: Renovación crea membresía con parámetros del nuevo plan**
    - Generar renovaciones con diferentes planes nuevos y verificar: remaining_days = allowed_days del nuevo plan (o NULL), fechas calculadas con VigencyService usando fecha de renovación como fecha de adquisición
    - **Valida: Requisitos 8.1, 8.2, 8.6**

  - [x] 9.4 Implementar API Route Handler de renovación
    - Crear `src/app/api/affiliates/[id]/renew/route.ts` (POST: body con newPlanId, newInstructorId?, observations?)
    - Validar que el plan seleccionado esté activo, retornar 400 si inactivo
    - Retornar confirmación con nuevo plan, días disponibles y fecha de vencimiento
    - _Requisitos: 8.1, 8.6, 8.7_

  - [x] 9.5 Implementar UI de renovación en perfil del afiliado
    - Agregar dialog de renovación en `affiliate-profile.tsx` con selector de plan activo, campo de instructor y observaciones
    - Mostrar historial de renovaciones en perfil (tabla con fecha, plan anterior, plan nuevo, instructor, días no usados)
    - _Requisitos: 8.1, 8.4, 8.6, 13.4_

  - [-]* 9.6 Escribir test de propiedad para filtrado exclusivo de planes activos
    - **Property 5: Filtrado exclusivo de planes activos en selección**
    - Generar conjuntos de planes con mezcla de activos e inactivos
    - Verificar que en contexto de selección (registro o renovación) SOLO aparecen planes con status='active'
    - **Valida: Requisitos 2.8, 3.8, 8.7**

- [x] 10. Punto de control - Verificar flujos principales
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 11. Módulo de Notificaciones
  - [x] 11.1 Implementar interfaz abstracta de notificaciones (Strategy pattern)
    - Crear `src/services/notification.service.ts` con interfaz `INotificationProvider` (send, getStatus)
    - Crear `src/services/whatsapp.service.ts` como implementación concreta de `INotificationProvider`
    - Implementar lógica de verificación diaria: buscar membresías dentro del umbral configurable, evitar duplicados por UNIQUE constraint
    - Implementar estrategia de reintentos: max 3 intentos, intervalo 5 minutos, registro de falla si agota reintentos
    - Crear `src/repositories/notification.repository.ts` con operaciones de log
    - _Requisitos: 9.1, 9.2, 9.3, 9.5, 9.6, 9.7_

  - [-]* 11.2 Escribir test de propiedad para unicidad de notificación por período
    - **Property 11: Unicidad de notificación por período de vencimiento**
    - Ejecutar verificación de notificaciones múltiples veces para el mismo par (afiliado, membresía)
    - Verificar que se genera como máximo UNA notificación, sin duplicados en ejecuciones posteriores
    - **Valida: Requisitos 9.3**

  - [-]* 11.3 Escribir test de propiedad para lógica de reintentos de notificación
    - **Property 12: Lógica de reintentos de notificación**
    - Generar notificaciones con diferentes valores de attempts (0-5) y status
    - Verificar: si attempts < 3, next_retry_at = last_attempt_at + 5 min; si attempts >= 3, fallo definitivo sin más reintentos
    - **Valida: Requisitos 9.6**

  - [x] 11.4 Implementar API Route Handler de notificaciones
    - Crear `src/app/api/notifications/check/route.ts` (POST: ejecutar verificación manual, solo admin/CRON)
    - Crear `src/app/api/notifications/route.ts` (GET: listar log de notificaciones, solo admin)
    - Proteger endpoints con verificación de rol admin
    - _Requisitos: 9.1, 9.6_

- [x] 12. Módulo de Tablero (Dashboard)
  - [x] 12.1 Implementar servicio y API de tablero
    - Crear `src/services/dashboard.service.ts` con consultas para: total afiliados, activos, vencidos, ingresos del día, renovaciones pendientes (dentro del umbral), cumpleaños del día, top 5 planes
    - Crear `src/app/api/dashboard/route.ts` (GET: métricas calculadas al momento, filtradas por RLS)
    - Las métricas del instructor se limitan a sus afiliados; admin ve todo
    - _Requisitos: 10.1, 10.2, 10.3, 10.4_

  - [x] 12.2 Implementar componentes UI de tablero
    - Crear `src/components/dashboard/stats-cards.tsx` con cards para cada métrica (total, activos, vencidos, ingresos hoy, pendientes renovación)
    - Crear `src/components/dashboard/birthdays-list.tsx` con lista de cumpleaños del día
    - Crear `src/components/dashboard/pending-renewals.tsx` con lista de afiliados próximos a vencer
    - Crear `src/components/dashboard/top-plans.tsx` con ranking de 5 planes más populares
    - Crear `src/hooks/use-dashboard.ts` con carga de métricas e indicador de error por métrica individual
    - Crear `src/app/(dashboard)/page.tsx` como página principal del tablero
    - Manejar error parcial: mostrar indicador de error en métrica afectada sin ocultar las que sí cargan
    - _Requisitos: 10.1, 10.2, 10.3, 10.4, 10.5, 13.4_

- [x] 13. Módulo de Informes
  - [x] 13.1 Implementar servicio y repositorio de informes
    - Crear `src/services/report.service.ts` con métodos para cada tipo de informe: historial de ingresos, historial de renovaciones, afiliados vencidos, afiliados activos, próximos a vencer, ingresos por día, ingresos por mes
    - Crear `src/repositories/report.repository.ts` con consultas optimizadas con filtros opcionales (rango fechas, afiliado, instructor)
    - Aplicar rango por defecto de 30 días cuando no se especifican fechas
    - Limitar rango máximo: 90 días para ingresos por día, 12 meses para ingresos por mes
    - Filtrar resultados por RLS (instructor ve solo sus datos)
    - _Requisitos: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10_

  - [x] 13.2 Implementar API Route Handlers de informes
    - Crear `src/app/api/reports/entries/route.ts` (GET: historial ingresos con filtros)
    - Crear `src/app/api/reports/renewals/route.ts` (GET: historial renovaciones con filtros)
    - Crear `src/app/api/reports/expired/route.ts` (GET: afiliados vencidos)
    - Crear `src/app/api/reports/active/route.ts` (GET: afiliados activos)
    - Crear `src/app/api/reports/expiring/route.ts` (GET: próximos a vencer)
    - Crear `src/app/api/reports/entries-by-day/route.ts` (GET: agrupado por día)
    - Crear `src/app/api/reports/entries-by-month/route.ts` (GET: agrupado por mes)
    - Validar parámetros de filtro con Zod, retornar mensaje si no hay resultados
    - _Requisitos: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.10_

  - [x] 13.3 Implementar componentes UI de informes
    - Crear `src/components/reports/report-filters.tsx` con selectores de tipo de informe, rango de fechas, afiliado e instructor
    - Crear `src/components/reports/report-table.tsx` con tabla de datos genérica usando Shadcn DataTable
    - Crear `src/hooks/use-reports.ts` con carga de informes por tipo y filtros
    - Crear `src/app/(dashboard)/reports/page.tsx` con tabs por tipo de informe
    - Mostrar mensaje cuando no hay resultados para los filtros aplicados
    - _Requisitos: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 13.4_

- [x] 14. Módulo de Configuración del Sistema
  - [x] 14.1 Implementar servicio y API de configuración
    - Crear `src/repositories/config.repository.ts` con operaciones GET/UPDATE sobre system_config
    - Crear `src/app/api/settings/route.ts` (GET: todos los parámetros)
    - Crear `src/app/api/settings/[key]/route.ts` (PUT: actualizar parámetro, solo admin)
    - Validar que solo admin puede modificar configuración
    - _Requisitos: 5.5, 5.6, 9.1, 9.4_

  - [x] 14.2 Implementar página UI de configuración
    - Crear `src/app/(dashboard)/settings/page.tsx` con formulario para cada parámetro configurable
    - Incluir: Regla_Inicio_Fin_de_Semana (toggle), umbral de notificación (número), hora de verificación (hora), plantilla de mensaje (textarea max 1024), tiempos de bloqueo
    - Solo visible/editable para admin; instructor ve valores sin poder modificar
    - _Requisitos: 5.5, 9.1, 9.4, 13.4_

  - [ ]* 14.3 Escribir test de propiedad para preservación de membresías ante cambio de regla
    - **Property 16: Preservación de membresías existentes ante cambio de regla**
    - Generar membresías existentes, simular cambio de Regla_Inicio_Fin_de_Semana
    - Verificar que start_date y expiration_date de membresías existentes permanecen inalterados
    - **Valida: Requisitos 5.6**

- [x] 15. Seguridad y validación transversal
  - [x] 15.1 Implementar sanitización XSS y validación server-side unificada
    - Crear utilidad de sanitización HTML para campos de texto libre en `src/lib/utils/sanitize.ts`
    - Integrar sanitización en todos los Route Handlers antes de guardar datos
    - Asegurar que errores de servidor retornan mensaje genérico al cliente sin exponer detalles internos
    - Implementar logging de errores con contexto (stack trace, operación, timestamp) solo en servidor
    - _Requisitos: 12.3, 12.4, 12.6, 12.7, 12.8_

  - [ ]* 15.2 Escribir test de propiedad para aislamiento de datos por instructor (RLS)
    - **Property 4: Aislamiento de datos por instructor (RLS)**
    - Generar consultas simuladas con diferentes instructor_ids
    - Verificar que TODOS los registros retornados pertenecen exclusivamente al instructor autenticado y que recursos creados tienen instructor_id = usuario autenticado
    - **Valida: Requisitos 2.2, 2.3, 3.5, 4.4, 10.3**

- [x] 16. Punto de control final - Verificar sistema completo
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los puntos de control aseguran validación incremental
- Los tests de propiedades validan propiedades universales de corrección definidas en el diseño
- Los tests unitarios validan ejemplos específicos y casos borde
- Las migraciones de base de datos se aplican usando Supabase MCP (`apply_migration`) al proyecto hosted `thcyjxnkcvpptdpbvqez`
- El campo `allowed_days = NULL` en plans indica plan ilimitado
- La tabla `memberships` diferencia `usage_start_date` (desde cuándo puede usar días) y `weeks_count_start_date` (desde cuándo cuentan las semanas de vigencia)
- La tabla `renewals` es inmutable (sin DELETE ni UPDATE por diseño)
- El `NotificationService` usa patrón Strategy para permitir cambio de proveedor de WhatsApp sin modificar lógica de negocio

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.9"] },
    { "id": 4, "tasks": ["2.3", "2.4", "2.5", "2.6", "2.7", "2.8"] },
    { "id": 5, "tasks": ["2.10"] },
    { "id": 6, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 7, "tasks": ["4.4", "4.5", "4.6"] },
    { "id": 8, "tasks": ["5.1", "6.1"] },
    { "id": 9, "tasks": ["5.2", "6.2", "6.3"] },
    { "id": 10, "tasks": ["5.3", "6.4", "6.5", "6.6"] },
    { "id": 11, "tasks": ["6.7", "6.8"] },
    { "id": 12, "tasks": ["6.9", "6.10"] },
    { "id": 13, "tasks": ["8.1"] },
    { "id": 14, "tasks": ["8.2", "8.3", "8.4", "8.5", "8.6"] },
    { "id": 15, "tasks": ["8.7"] },
    { "id": 16, "tasks": ["9.1"] },
    { "id": 17, "tasks": ["9.2", "9.3", "9.4"] },
    { "id": 18, "tasks": ["9.5", "9.6"] },
    { "id": 19, "tasks": ["11.1"] },
    { "id": 20, "tasks": ["11.2", "11.3", "11.4"] },
    { "id": 21, "tasks": ["12.1", "13.1"] },
    { "id": 22, "tasks": ["12.2", "13.2"] },
    { "id": 23, "tasks": ["13.3"] },
    { "id": 24, "tasks": ["14.1"] },
    { "id": 25, "tasks": ["14.2", "14.3"] },
    { "id": 26, "tasks": ["15.1"] },
    { "id": 27, "tasks": ["15.2"] }
  ]
}
```
