/**
 * Notification service — implements the Strategy pattern for notification delivery.
 * Provides an abstract INotificationProvider interface and orchestrates the
 * notification workflow: checking expiring memberships, sending notifications,
 * handling retries, and preventing duplicates.
 *
 * Uses the admin client (service role) to bypass RLS for notification operations.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.5, 9.6, 9.7
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { todayColombia, nowColombia } from '@/lib/utils/date.utils'
import * as notificationRepository from '@/repositories/notification.repository'
import { WhatsAppNotificationProvider } from '@/services/whatsapp.service'

// --- Constants ---

/** Maximum number of send attempts before marking as failed */
const MAX_ATTEMPTS = 3

/** Retry interval in minutes */
const RETRY_INTERVAL_MINUTES = 5

/** Default notification threshold in days (configurable via system_config) */
const DEFAULT_THRESHOLD_DAYS = 2

/** Default notification type */
const NOTIFICATION_TYPE = 'expiration_reminder'

/** Content SID for the expiration notification template in Twilio */
const EXPIRATION_CONTENT_SID = 'HXf8d6b8a744e03e8b1fea98635ad0919a'

// --- Interfaces ---

/** Payload for sending a notification */
export interface NotificationPayload {
  recipientPhone: string
  affiliateName: string
  expirationDate: string
  message: string
  templateId?: string
}

/** Result of a send attempt */
export interface NotificationResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Abstract notification provider interface (Strategy pattern).
 * Allows swapping the underlying messaging provider without modifying business logic.
 */
export interface INotificationProvider {
  /** Send a notification to the recipient */
  send(payload: NotificationPayload): Promise<NotificationResult>

  /** Check the delivery status of a previously sent message */
  getStatus(messageId: string): Promise<'sent' | 'delivered' | 'failed'>
}

/** Result summary of the check-and-notify process */
export interface CheckAndNotifyResult {
  sent: number
  failed: number
  skipped: number
}

// --- Service Implementation ---

/** The active notification provider instance */
let provider: INotificationProvider = new WhatsAppNotificationProvider()

/**
 * Sets the notification provider (useful for testing or switching providers).
 *
 * @param newProvider - The notification provider to use
 */
export function setProvider(newProvider: INotificationProvider): void {
  provider = newProvider
}

/**
 * Gets the current notification provider.
 *
 * @returns The active notification provider
 */
export function getProvider(): INotificationProvider {
  return provider
}

/**
 * Checks for expiring memberships and sends notifications.
 *
 * Flow:
 * 1. Read notification_threshold_days from system_config (default: 2 days)
 * 2. Read notification_template from system_config
 * 3. Query active memberships expiring within the threshold using admin client
 * 4. For each membership:
 *    a. Check if notification already exists (UNIQUE constraint on affiliate_id+membership_id+type)
 *    b. If exists, skip (already processed)
 *    c. If affiliate has no phone, create notification with status='skipped' and log reason
 *    d. Otherwise, create notification record and attempt to send
 *    e. On failure: increment attempts, set next_retry_at, mark as 'failed' if max attempts reached
 *
 * @returns Summary of sent, failed, and skipped notifications
 */
export async function checkAndNotifyExpiringMemberships(): Promise<CheckAndNotifyResult> {
  const result: CheckAndNotifyResult = { sent: 0, failed: 0, skipped: 0 }

  const supabase = createAdminClient()

  // 1. Get the notification threshold from system_config
  const thresholdDays = await getConfigValue<number>(
    'notification_threshold_days',
    DEFAULT_THRESHOLD_DAYS,
    (val) => (val as { days?: number }).days
  )

  // 2. Get the notification template
  const template = await getConfigValue<string>(
    'notification_template',
    'Hola {{nombre}}, tu membresía vence el {{fecha_vencimiento}} y te quedan {{dias_restantes}} días disponibles. ¡Renueva para seguir entrenando!',
    (val) => (val as { template?: string }).template
  )

  // 3. Query expiring memberships: by date OR by remaining days (using admin client to bypass RLS)
  const today = nowColombia()
  const thresholdDate = new Date(today)
  thresholdDate.setDate(thresholdDate.getDate() + thresholdDays)

  const todayStr = todayColombia()
  const thresholdStr = thresholdDate.toISOString().split('T')[0]

  // Query all active memberships that are not yet expired by date
  const { data: allActiveMemberships, error: queryError } = await supabase
    .from('memberships')
    .select('*, affiliates(*)')
    .eq('status', 'active')
    .gte('expiration_date', todayStr)
    .order('expiration_date', { ascending: true })

  if (queryError) {
    throw new Error(`Error al buscar membresías por vencer: ${queryError.message}`)
  }

  // Filter: expiring by date (within threshold) OR by remaining_days (<= threshold)
  const expiringMemberships = (allActiveMemberships ?? []).filter((m) => {
    const expiringByDate = m.expiration_date <= thresholdStr
    const expiringByDays = m.remaining_days !== null && m.remaining_days <= thresholdDays
    return expiringByDate || expiringByDays
  })

  if (!expiringMemberships || expiringMemberships.length === 0) {
    return result
  }

  // 4. Process each expiring membership
  for (const membership of expiringMemberships) {
    const affiliate = membership.affiliates as {
      id: string
      full_name: string
      phone: string | null
      document_id: string
    } | null

    if (!affiliate) {
      continue
    }

    // 4a. Check if notification already exists for this affiliate+membership+type
    const existing = await notificationRepository.findByAffiliateMembershipAndType(
      affiliate.id,
      membership.id,
      NOTIFICATION_TYPE
    )

    if (existing) {
      // Already processed — skip
      result.skipped++
      continue
    }

    // 4c. Check if affiliate has a phone number
    if (!affiliate.phone || affiliate.phone.trim().length === 0) {
      // Create skipped notification with reason logged
      await notificationRepository.create({
        affiliate_id: affiliate.id,
        membership_id: membership.id,
        notification_type: NOTIFICATION_TYPE,
        status: 'skipped',
        attempts: 0,
        error_message: `Afiliado ${affiliate.document_id} no tiene número de celular registrado.`,
      })

      console.log(
        `[NotificationService] Omitido: Afiliado ${affiliate.document_id} sin número de celular.`
      )

      result.skipped++
      continue
    }

    // 4d. Build contentVariables for Twilio Content Template
    // Template: Hola {{1}}, tu membresía vence el {{2}} y te quedan {{3}} días disponibles. ¡Renueva para seguir entrenando!
    const diasRestantes = membership.remaining_days !== null
      ? String(membership.remaining_days)
      : 'Ilimitado'

    // Create notification record in pending state
    const notification = await notificationRepository.create({
      affiliate_id: affiliate.id,
      membership_id: membership.id,
      notification_type: NOTIFICATION_TYPE,
      status: 'pending',
      attempts: 0,
      phone_used: affiliate.phone,
    })

    // Attempt to send using Content Template
    const whatsappProvider = provider as import('@/services/whatsapp.service').WhatsAppNotificationProvider

    let sendResult: NotificationResult

    if ('sendWithTemplate' in whatsappProvider) {
      sendResult = await whatsappProvider.sendWithTemplate({
        recipientPhone: affiliate.phone,
        contentSid: EXPIRATION_CONTENT_SID,
        contentVariables: {
          '1': affiliate.full_name,
          '2': membership.expiration_date,
          '3': diasRestantes,
        },
      })
    } else {
      // Fallback: plain text
      const message = `Hola ${affiliate.full_name}, tu membresía vence el ${membership.expiration_date} y te quedan ${diasRestantes} días disponibles. ¡Renueva para seguir entrenando!`
      sendResult = await provider.send({
        recipientPhone: affiliate.phone,
        affiliateName: affiliate.full_name,
        expirationDate: membership.expiration_date,
        message,
      })
    }

    // Update notification record based on result
    if (sendResult.success) {
      await notificationRepository.update(notification.id, {
        status: 'sent',
        attempts: 1,
        last_attempt_at: new Date().toISOString(),
        external_message_id: sendResult.messageId ?? null,
      })
      result.sent++
    } else {
      await handleSendFailure(notification.id, sendResult.error ?? 'Error desconocido')
      result.failed++
    }
  }

  return result
}

/**
 * Retries failed notifications that haven't exhausted their max attempts.
 * Queries notifications with status='pending', attempts > 0, attempts < MAX_ATTEMPTS,
 * and next_retry_at <= now.
 */
export async function retryFailedNotifications(): Promise<void> {
  const supabase = createAdminClient()

  // Get notifications eligible for retry
  const pendingNotifications = await notificationRepository.findPendingForRetry()

  for (const notification of pendingNotifications) {
    // Get affiliate info for the message
    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('full_name, phone, document_id')
      .eq('id', notification.affiliate_id)
      .single()

    if (!affiliate || !affiliate.phone) {
      // Mark as failed if affiliate no longer has phone
      await notificationRepository.update(notification.id, {
        status: 'failed',
        error_message: 'Afiliado no encontrado o sin teléfono durante reintento.',
      })
      continue
    }

    // Get membership for expiration date
    const { data: membership } = await supabase
      .from('memberships')
      .select('expiration_date')
      .eq('id', notification.membership_id)
      .single()

    if (!membership) {
      await notificationRepository.update(notification.id, {
        status: 'failed',
        error_message: 'Membresía no encontrada durante reintento.',
      })
      continue
    }

    // Get template for message
    const template = await getConfigValue<string>(
      'notification_template',
      'Hola {{nombre}}, tu membresía vence el {{fecha_vencimiento}} y te quedan {{dias_restantes}} días disponibles. ¡Renueva para seguir entrenando!',
      (val) => (val as { template?: string }).template
    )

    // Get membership remaining_days for the {{dias_restantes}} placeholder
    const { data: membershipFull } = await supabase
      .from('memberships')
      .select('remaining_days')
      .eq('id', notification.membership_id)
      .single()

    const diasRestantes = membershipFull?.remaining_days !== null && membershipFull?.remaining_days !== undefined
      ? String(membershipFull.remaining_days)
      : 'Ilimitado'

    const message = template
      .replace('{{nombre}}', affiliate.full_name)
      .replace('{{fecha_vencimiento}}', membership.expiration_date)
      .replace('{{dias_restantes}}', diasRestantes)

    // Attempt to send
    await attemptSend(notification.id, {
      recipientPhone: affiliate.phone,
      affiliateName: affiliate.full_name,
      expirationDate: membership.expiration_date,
      message,
    })
  }
}

// --- Private Helpers ---

/**
 * Attempts to send a notification and updates the notification record accordingly.
 *
 * @param notificationId - The notification record ID
 * @param payload - The notification payload
 * @returns The send result
 */
async function attemptSend(
  notificationId: string,
  payload: NotificationPayload
): Promise<NotificationResult> {
  const supabase = createAdminClient()
  const now = new Date()

  // Get current attempts count
  const { data: current } = await supabase
    .from('notifications')
    .select('attempts')
    .eq('id', notificationId)
    .single()

  const currentAttempts = current?.attempts ?? 0

  try {
    const sendResult = await provider.send(payload)

    if (sendResult.success) {
      // Mark as sent with incremented attempts
      await notificationRepository.update(notificationId, {
        status: 'sent',
        attempts: currentAttempts + 1,
        last_attempt_at: now.toISOString(),
        external_message_id: sendResult.messageId ?? null,
        next_retry_at: null,
        error_message: null,
      })

      return sendResult
    }

    // Send failed — handle retry logic
    return await handleSendFailure(notificationId, sendResult.error ?? 'Error desconocido')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error inesperado al enviar'
    return await handleSendFailure(notificationId, errorMessage)
  }
}

/**
 * Handles a send failure: increments attempts, sets next_retry_at, or marks as failed.
 *
 * @param notificationId - The notification record ID
 * @param errorMessage - Description of the failure
 * @returns The failure result
 */
async function handleSendFailure(
  notificationId: string,
  errorMessage: string
): Promise<NotificationResult> {
  const supabase = createAdminClient()
  const now = new Date()

  // Get current notification to read attempts count
  const { data: current } = await supabase
    .from('notifications')
    .select('attempts')
    .eq('id', notificationId)
    .single()

  const currentAttempts = current?.attempts ?? 0
  const newAttempts = currentAttempts + 1

  if (newAttempts >= MAX_ATTEMPTS) {
    // Exhausted all retries — mark as failed permanently
    await notificationRepository.update(notificationId, {
      status: 'failed',
      attempts: newAttempts,
      last_attempt_at: now.toISOString(),
      next_retry_at: null,
      error_message: errorMessage,
    })

    console.log(
      `[NotificationService] Fallo definitivo para notificación ${notificationId} tras ${newAttempts} intentos: ${errorMessage}`
    )
  } else {
    // Schedule retry
    const nextRetry = new Date(now)
    nextRetry.setMinutes(nextRetry.getMinutes() + RETRY_INTERVAL_MINUTES)

    await notificationRepository.update(notificationId, {
      status: 'pending',
      attempts: newAttempts,
      last_attempt_at: now.toISOString(),
      next_retry_at: nextRetry.toISOString(),
      error_message: errorMessage,
    })

    console.log(
      `[NotificationService] Reintento programado para notificación ${notificationId}. Intento ${newAttempts}/${MAX_ATTEMPTS}. Próximo: ${nextRetry.toISOString()}`
    )
  }

  return { success: false, error: errorMessage }
}

/**
 * Fetches a configuration value from system_config.
 *
 * @param key - The config key
 * @param defaultValue - Default value if not found
 * @param extractor - Function to extract the desired value from the JSONB value field
 * @returns The configuration value
 */
async function getConfigValue<T>(
  key: string,
  defaultValue: T,
  extractor: (val: unknown) => T | undefined
): Promise<T> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', key)
    .single()

  if (error || !data) {
    return defaultValue
  }

  const extracted = extractor(data.value)
  return extracted ?? defaultValue
}

// --- Auto-Expire Memberships ---

/** Days of grace after plan exhaustion before marking as expired */
const GRACE_PERIOD_DAYS = 2

/**
 * Marks memberships as 'expired' when:
 * 1. remaining_days = 0 AND it's been more than GRACE_PERIOD_DAYS since last entry, OR
 * 2. expiration_date has passed by more than GRACE_PERIOD_DAYS
 *
 * This should run daily via CRON.
 * @returns Number of memberships expired
 */
export async function expireStaleActiveMemberships(): Promise<number> {
  const supabase = createAdminClient()

  const today = nowColombia()
  const graceDate = new Date(today)
  graceDate.setDate(graceDate.getDate() - GRACE_PERIOD_DAYS)
  const graceDateStr = graceDate.toISOString().split('T')[0]

  // Find active memberships that should be expired:
  // 1. expiration_date passed more than 2 days ago
  const { data: expiredByDate, error: err1 } = await supabase
    .from('memberships')
    .update({ status: 'expired', expired_detected_at: new Date().toISOString() })
    .eq('status', 'active')
    .lt('expiration_date', graceDateStr)
    .select('id')

  if (err1) {
    console.error(`[ExpireService] Error al expirar por fecha: ${err1.message}`)
  }

  // 2. remaining_days = 0 for more than 2 days (check updated_at as proxy for when it hit 0)
  const { data: expiredByDays, error: err2 } = await supabase
    .from('memberships')
    .update({ status: 'expired', expired_detected_at: new Date().toISOString() })
    .eq('status', 'active')
    .eq('remaining_days', 0)
    .lt('updated_at', graceDate.toISOString())
    .select('id')

  if (err2) {
    console.error(`[ExpireService] Error al expirar por días agotados: ${err2.message}`)
  }

  const totalExpired = (expiredByDate?.length ?? 0) + (expiredByDays?.length ?? 0)

  if (totalExpired > 0) {
    console.log(`[ExpireService] ${totalExpired} membresías marcadas como expiradas.`)
  }

  return totalExpired
}

// --- Expiration Notification (triggered on entry) ---

/**
 * Sends a "plan consumed" SMS when remaining_days reaches 0.
 * Uses notification_type 'plan_consumed' to avoid conflict with expiration_reminder.
 * Fire-and-forget.
 */
export async function sendPlanConsumedNotification(
  affiliateId: string,
  affiliateName: string,
  phone: string | null | undefined,
  membershipId: string
): Promise<void> {
  try {
    if (!phone || phone.trim().length === 0) {
      return
    }

    // Check if already sent for this membership
    const existing = await notificationRepository.findByAffiliateMembershipAndType(
      affiliateId,
      membershipId,
      'plan_consumed'
    )

    if (existing) return

    const message = `Hola ${affiliateName}, has consumido todos los dias de tu plan en UruzTraining. Renueva tu plan para seguir entrenando!`

    const notification = await notificationRepository.create({
      affiliate_id: affiliateId,
      membership_id: membershipId,
      notification_type: 'plan_consumed',
      status: 'pending',
      attempts: 0,
      phone_used: phone,
    })

    const result = await provider.send({
      recipientPhone: phone,
      affiliateName,
      expirationDate: '',
      message,
    })

    if (result.success) {
      await notificationRepository.update(notification.id, {
        status: 'sent',
        attempts: 1,
        last_attempt_at: new Date().toISOString(),
        external_message_id: result.messageId ?? null,
      })
      console.log(`[NotificationService] Plan agotado enviado a ${affiliateName} (${phone})`)
    } else {
      await notificationRepository.update(notification.id, {
        status: 'failed',
        attempts: 1,
        last_attempt_at: new Date().toISOString(),
        error_message: result.error ?? 'Error desconocido',
      })
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
    console.error(`[NotificationService] Excepción plan agotado ${affiliateId}: ${errorMsg}`)
  }
}

/**
 * Sends an expiration SMS notification when remaining days drop within the threshold.
 * Fire-and-forget: errors are logged but never thrown.
 * Checks if a notification was already sent for this membership to avoid duplicates.
 *
 * @param affiliateId - UUID of the affiliate
 * @param affiliateName - Full name
 * @param phone - Phone number
 * @param membershipId - UUID of the membership
 * @param expirationDate - Expiration date string
 * @param remainingDays - Days remaining after the entry
 */
export async function sendExpirationNotification(
  affiliateId: string,
  affiliateName: string,
  phone: string | null | undefined,
  membershipId: string,
  expirationDate: string,
  remainingDays: number
): Promise<void> {
  try {
    if (!phone || phone.trim().length === 0) {
      console.log(`[NotificationService] Vencimiento omitido: ${affiliateId} sin celular.`)
      return
    }

    // Check if already notified for this membership
    const existing = await notificationRepository.findByAffiliateMembershipAndType(
      affiliateId,
      membershipId,
      'expiration_reminder'
    )

    if (existing) {
      // Already sent — don't duplicate
      return
    }

    // Build and send the expiration SMS
    const diasRestantes = String(remainingDays)
    const message = `Hola ${affiliateName}, tu membresia vence el ${expirationDate} y te quedan ${diasRestantes} dias disponibles. Renueva para seguir entrenando! - UruzTraining`

    // Create notification record
    const notification = await notificationRepository.create({
      affiliate_id: affiliateId,
      membership_id: membershipId,
      notification_type: 'expiration_reminder',
      status: 'pending',
      attempts: 0,
      phone_used: phone,
    })

    // Send SMS
    const result = await provider.send({
      recipientPhone: phone,
      affiliateName,
      expirationDate,
      message,
    })

    if (result.success) {
      await notificationRepository.update(notification.id, {
        status: 'sent',
        attempts: 1,
        last_attempt_at: new Date().toISOString(),
        external_message_id: result.messageId ?? null,
      })
      console.log(`[NotificationService] Vencimiento enviado a ${affiliateName} (${phone}). ID: ${result.messageId}`)
    } else {
      await notificationRepository.update(notification.id, {
        status: 'failed',
        attempts: 1,
        last_attempt_at: new Date().toISOString(),
        error_message: result.error ?? 'Error desconocido',
      })
      console.error(`[NotificationService] Error enviando vencimiento a ${affiliateName}: ${result.error}`)
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
    console.error(`[NotificationService] Excepción en vencimiento para ${affiliateId}: ${errorMsg}`)
  }
}

// --- Welcome Notification ---

/** Content SID for the welcome template in Twilio */
const WELCOME_CONTENT_SID = 'HX1ec0b531372bcb8f2582aaf2e6243630'

/**
 * Sends a welcome WhatsApp notification using a Twilio Content Template.
 * Uses contentSid + contentVariables format required by Twilio approved templates.
 * This is fire-and-forget: errors are logged but never thrown.
 *
 * Template variables:
 *   1 = Nombre del usuario
 *   2 = Nombre del plan
 *   3 = Días disponibles
 *   4 = Fecha de vencimiento
 *
 * @param affiliateId - UUID of the affiliate
 * @param affiliateName - Full name of the affiliate
 * @param phone - Phone number (may be null/empty)
 * @param planName - Name of the assigned plan
 * @param allowedDays - Number of allowed days (null for unlimited plans)
 * @param vigencyWeeks - Number of vigency weeks for the plan
 * @param expirationDate - Membership expiration date (YYYY-MM-DD)
 */
export async function sendWelcomeNotification(
  affiliateId: string,
  affiliateName: string,
  phone: string | null | undefined,
  planName: string,
  allowedDays: number | null,
  vigencyWeeks: number,
  expirationDate: string
): Promise<void> {
  try {
    if (!phone || phone.trim().length === 0) {
      console.log(
        `[NotificationService] Bienvenida omitida: Afiliado ${affiliateId} sin número de celular.`
      )
      return
    }

    const diasDisponibles = allowedDays !== null ? String(allowedDays) : 'Ilimitados'

    // Use Twilio Content Template with contentSid and contentVariables
    // Template: ¡Bienvenido a UruzTraining, {{1}}! 🏋️ Tu plan: {{2}} - {{3}} días disponibles para usar en {{4}} semanas (hasta el {{5}}). ¡A entrenar!
    const whatsappProvider = provider as import('@/services/whatsapp.service').WhatsAppNotificationProvider

    if ('sendWithTemplate' in whatsappProvider) {
      const result = await whatsappProvider.sendWithTemplate({
        recipientPhone: phone,
        contentSid: WELCOME_CONTENT_SID,
        contentVariables: {
          '1': affiliateName,
          '2': planName,
          '3': diasDisponibles,
          '4': String(vigencyWeeks),
          '5': expirationDate,
        },
      })

      if (result.success) {
        console.log(
          `[NotificationService] Bienvenida (template) enviada a ${affiliateName} (${phone}). ID: ${result.messageId}`
        )
      } else {
        console.error(
          `[NotificationService] Error enviando bienvenida (template) a ${affiliateName}: ${result.error}`
        )
      }
    } else {
      // Fallback: send as plain text if provider doesn't support templates
      const message = `¡Bienvenido a UruzTraining, ${affiliateName}! 🏋️ Tu plan: ${planName} - ${diasDisponibles} días disponibles para usar en ${vigencyWeeks} semanas (hasta el ${expirationDate}). ¡A entrenar!`

      const result = await provider.send({
        recipientPhone: phone,
        affiliateName,
        expirationDate,
        message,
      })

      if (result.success) {
        console.log(
          `[NotificationService] Bienvenida enviada a ${affiliateName} (${phone}). ID: ${result.messageId}`
        )
      } else {
        console.error(
          `[NotificationService] Error enviando bienvenida a ${affiliateName}: ${result.error}`
        )
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
    console.error(
      `[NotificationService] Excepción en bienvenida para afiliado ${affiliateId}: ${errorMsg}`
    )
  }
}
