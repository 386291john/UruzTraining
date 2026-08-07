/**
 * Entry service — implements the entry validation and registration flow.
 * Validates affiliate identity, PIN, membership status, and registers gym entries.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
 */

import { createClient } from '@/lib/supabase/server'
import { isExpired } from '@/services/vigency.service'
import { sendExpirationNotification, sendPlanConsumedNotification } from '@/services/notification.service'
import { todayColombia, nowColombiaISO } from '@/lib/utils/date.utils'
import * as EntryRepository from '@/repositories/entry.repository'
import * as MembershipRepository from '@/repositories/membership.repository'
import * as AffiliateRepository from '@/repositories/affiliate.repository'

// --- Constants ---

/** Maximum consecutive PIN failures before lockout */
const PIN_MAX_ATTEMPTS = 3

/** Lockout duration in minutes after exceeding max PIN attempts */
const PIN_LOCKOUT_MINUTES = 15

// --- Interfaces ---

/** Error codes returned by the entry validation process */
export type EntryErrorCode =
  | 'AFFILIATE_NOT_FOUND'
  | 'PIN_MISMATCH'
  | 'PIN_BLOCKED'
  | 'MEMBERSHIP_EXPIRED'
  | 'NO_DAYS_REMAINING'
  | 'ALREADY_ENTERED'

/** Error detail returned when entry validation fails */
export interface EntryError {
  code: EntryErrorCode
  message: string
  metadata?: Record<string, unknown>
}

/** Success data returned when entry is registered */
export interface EntrySuccessData {
  affiliateName: string
  planName: string
  remainingDays: number | null
  expirationDate: string
}

/** Result of the entry validation and registration process */
export interface EntryValidationResult {
  success: boolean
  error?: EntryError
  entry?: EntrySuccessData
}

// --- Main Service Function ---

/**
 * Validates an affiliate's identity and registers a gym entry.
 *
 * Validation order (strict priority):
 * 1. Affiliate existence by document_id
 * 2. PIN lockout check (pin_blocked_until > now)
 * 3. PIN match verification (with lockout logic on failure)
 * 4. Active membership and vigency check
 * 5. Remaining days check (for limited plans)
 * 6. Daily duplicate entry check
 *
 * On success: creates entry record, decrements remaining_days (if applicable),
 * resets PIN failed attempts.
 *
 * @param documentId - The affiliate's government-issued document ID
 * @param pin - The 4-digit PIN for authentication
 * @param registeredBy - UUID of the user registering the entry (instructor/admin)
 * @returns Validation result with success data or error details
 */
export async function validateAndRegisterEntry(
  documentId: string,
  pin: string,
  registeredBy: string
): Promise<EntryValidationResult> {
  const supabase = createClient()

  // --- Step 1: Find affiliate by document_id ---
  const affiliate = await AffiliateRepository.findByDocumentId(documentId)

  if (!affiliate) {
    return {
      success: false,
      error: {
        code: 'AFFILIATE_NOT_FOUND',
        message: 'Afiliado no encontrado. Verifique el número de documento.',
      },
    }
  }

  // --- Step 2: Check if PIN is blocked ---
  if (affiliate.pin_blocked_until) {
    const blockedUntil = new Date(affiliate.pin_blocked_until)
    const now = new Date()

    if (blockedUntil > now) {
      const remainingMs = blockedUntil.getTime() - now.getTime()
      const remainingMinutes = Math.ceil(remainingMs / (1000 * 60))

      return {
        success: false,
        error: {
          code: 'PIN_BLOCKED',
          message: `PIN bloqueado temporalmente. Intente nuevamente en ${remainingMinutes} minuto${remainingMinutes !== 1 ? 's' : ''}.`,
          metadata: {
            blockedUntil: affiliate.pin_blocked_until,
            remainingMinutes,
          },
        },
      }
    }
  }

  // --- Step 3: Verify PIN ---
  if (affiliate.pin !== pin) {
    // Increment failed attempts
    const newAttempts = affiliate.pin_failed_attempts + 1
    const updateData: Record<string, unknown> = {
      pin_failed_attempts: newAttempts,
      updated_at: new Date().toISOString(),
    }

    // Block if max attempts reached
    if (newAttempts >= PIN_MAX_ATTEMPTS) {
      const blockUntil = new Date()
      blockUntil.setMinutes(blockUntil.getMinutes() + PIN_LOCKOUT_MINUTES)
      updateData.pin_blocked_until = blockUntil.toISOString()
    }

    // Update affiliate with failed attempt count
    const { error: updateError } = await supabase
      .from('affiliates')
      .update(updateData)
      .eq('id', affiliate.id)

    if (updateError) {
      throw new Error(`Error al actualizar intentos de PIN: ${updateError.message}`)
    }

    const attemptsRemaining = PIN_MAX_ATTEMPTS - newAttempts

    return {
      success: false,
      error: {
        code: 'PIN_MISMATCH',
        message:
          newAttempts >= PIN_MAX_ATTEMPTS
            ? `PIN incorrecto. Se ha bloqueado el acceso por ${PIN_LOCKOUT_MINUTES} minutos.`
            : `PIN incorrecto. ${attemptsRemaining} intento${attemptsRemaining !== 1 ? 's' : ''} restante${attemptsRemaining !== 1 ? 's' : ''}.`,
        metadata: {
          failedAttempts: newAttempts,
          maxAttempts: PIN_MAX_ATTEMPTS,
          blocked: newAttempts >= PIN_MAX_ATTEMPTS,
        },
      },
    }
  }

  // --- Step 4: PIN matches — reset failed attempts ---
  if (affiliate.pin_failed_attempts > 0 || affiliate.pin_blocked_until) {
    const { error: resetError } = await supabase
      .from('affiliates')
      .update({
        pin_failed_attempts: 0,
        pin_blocked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', affiliate.id)

    if (resetError) {
      throw new Error(`Error al resetear intentos de PIN: ${resetError.message}`)
    }
  }

  // --- Step 5: Check active membership and vigency ---
  const membership = await MembershipRepository.findActiveByAffiliateId(affiliate.id)

  if (!membership) {
    return {
      success: false,
      error: {
        code: 'MEMBERSHIP_EXPIRED',
        message: 'No tiene una membresía activa. Contacte a su instructor para renovar.',
      },
    }
  }

  // Check if membership is expired
  const expirationDate = new Date(membership.expiration_date)
  if (isExpired(expirationDate)) {
    return {
      success: false,
      error: {
        code: 'MEMBERSHIP_EXPIRED',
        message: 'Su membresía ha vencido. Contacte a su instructor para renovar.',
        metadata: {
          expirationDate: membership.expiration_date,
          daysLost: membership.days_lost,
        },
      },
    }
  }

  // --- Step 6: Check remaining days ---
  if (membership.remaining_days !== null && membership.remaining_days <= 0) {
    return {
      success: false,
      error: {
        code: 'NO_DAYS_REMAINING',
        message: 'No tiene días disponibles en su plan. Contacte a su instructor para renovar.',
        metadata: {
          remainingDays: 0,
          expirationDate: membership.expiration_date,
        },
      },
    }
  }

  // --- Step 7: Check duplicate entry for today ---
  const alreadyEntered = await EntryRepository.hasEntryToday(affiliate.id)

  if (alreadyEntered) {
    return {
      success: false,
      error: {
        code: 'ALREADY_ENTERED',
        message: 'Ya registró ingreso hoy. Solo se permite un ingreso por día.',
      },
    }
  }

  // --- Step 8: All validations passed — register entry ---
  const today = todayColombia()

  // Create entry record (entry_time is timestamptz, needs full ISO string)
  await EntryRepository.create({
    affiliate_id: affiliate.id,
    membership_id: membership.id,
    entry_date: today,
    entry_time: nowColombiaISO(),
    registered_by: registeredBy,
  })

  // Decrement remaining_days (only for limited plans where remaining_days is not null)
  let updatedRemainingDays = membership.remaining_days
  if (membership.remaining_days !== null) {
    updatedRemainingDays = membership.remaining_days - 1

    const { error: decrementError } = await supabase
      .from('memberships')
      .update({
        remaining_days: updatedRemainingDays,
        updated_at: nowColombiaISO(),
      })
      .eq('id', membership.id)

    if (decrementError) {
      throw new Error(`Error al descontar día del plan: ${decrementError.message}`)
    }
  }

  // Get plan name for the response
  const planName = membership.plans?.name ?? 'Plan'

  // --- Step 9: Send notifications based on remaining days ---
  if (updatedRemainingDays !== null) {
    if (updatedRemainingDays === 0) {
      // Plan consumed — send "plan agotado" notification
      void sendPlanConsumedNotification(
        affiliate.id,
        affiliate.full_name,
        affiliate.phone,
        membership.id
      )
    } else if (updatedRemainingDays <= 2) {
      // Near expiration — send reminder
      void sendExpirationNotification(
        affiliate.id,
        affiliate.full_name,
        affiliate.phone,
        membership.id,
        membership.expiration_date,
        updatedRemainingDays
      )
    }
  }

  return {
    success: true,
    entry: {
      affiliateName: affiliate.full_name,
      planName,
      remainingDays: updatedRemainingDays,
      expirationDate: membership.expiration_date,
    },
  }
}
