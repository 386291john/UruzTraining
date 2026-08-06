/**
 * Notification repository — encapsulates all database operations for the notifications table.
 * Uses the admin Supabase client (service role) to bypass RLS since notifications
 * are managed by the system, not individual users.
 *
 * Validates: Requirements 9.3, 9.6, 9.7
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/types/database'

/** Row type returned from the notifications table */
export type Notification = Tables<'notifications'>

/** Insert type for creating a notification */
export type NotificationInsert = TablesInsert<'notifications'>

/** Update type for modifying a notification */
export type NotificationUpdate = TablesUpdate<'notifications'>

/** Notification status values */
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'skipped'

/**
 * Creates a new notification record.
 *
 * @param data - The notification data to insert
 * @returns The created notification
 */
export async function create(data: NotificationInsert): Promise<Notification> {
  const supabase = createAdminClient()

  const { data: notification, error } = await supabase
    .from('notifications')
    .insert(data)
    .select()
    .single()

  if (error) {
    throw new Error(`Error al crear notificación: ${error.message}`)
  }

  return notification
}

/**
 * Updates an existing notification record.
 *
 * @param id - Notification UUID
 * @param data - Fields to update
 * @returns The updated notification
 */
export async function update(id: string, data: NotificationUpdate): Promise<Notification> {
  const supabase = createAdminClient()

  const { data: notification, error } = await supabase
    .from('notifications')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Error al actualizar notificación: ${error.message}`)
  }

  return notification
}

/**
 * Finds a notification by affiliate_id, membership_id, and notification_type.
 * Used to check for duplicates before creating a new notification.
 *
 * @param affiliateId - Affiliate UUID
 * @param membershipId - Membership UUID
 * @param notificationType - The type of notification (default: 'expiration_reminder')
 * @returns The existing notification or null if not found
 */
export async function findByAffiliateMembershipAndType(
  affiliateId: string,
  membershipId: string,
  notificationType: string = 'expiration_reminder'
): Promise<Notification | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('affiliate_id', affiliateId)
    .eq('membership_id', membershipId)
    .eq('notification_type', notificationType)
    .limit(1)
    .single()

  if (error) {
    // PGRST116 = no rows returned
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Error al buscar notificación existente: ${error.message}`)
  }

  return data
}

/**
 * Finds all pending notifications that are ready for retry.
 * A notification is eligible for retry when:
 * - status is 'pending' and attempts > 0 (previously failed attempt)
 * - next_retry_at <= now (retry interval has passed)
 * - attempts < 3 (hasn't exhausted max retries)
 *
 * @returns Array of notifications ready for retry
 */
export async function findPendingForRetry(): Promise<Notification[]> {
  const supabase = createAdminClient()

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('status', 'pending')
    .gt('attempts', 0)
    .lt('attempts', 3)
    .lte('next_retry_at', now)
    .order('next_retry_at', { ascending: true })

  if (error) {
    throw new Error(`Error al buscar notificaciones pendientes de reintento: ${error.message}`)
  }

  return data ?? []
}

/**
 * Finds all notifications (for admin listing).
 *
 * @param options - Optional filters
 * @returns Array of notifications
 */
export async function findAll(options?: {
  status?: NotificationStatus
  limit?: number
  offset?: number
}): Promise<Notification[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })

  if (options?.status) {
    query = query.eq('status', options.status)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 20) - 1)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Error al listar notificaciones: ${error.message}`)
  }

  return data ?? []
}
