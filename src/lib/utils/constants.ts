/**
 * System-wide constants for UruzTraining gym management
 */

// Timezone for all date/time operations (Colombia UTC-5)
export const TIMEZONE = 'America/Bogota' as const

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const

// Field length constraints
export const FIELD_LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 100,
  PHONE_MIN: 7,
  PHONE_MAX: 20,
  EMAIL_MAX: 255,
  NOTES_MAX: 500,
  PIN_LENGTH: 4,
  PLAN_NAME_MAX: 100,
  PLAN_DESCRIPTION_MAX: 500,
} as const

// Membership status
export const MEMBERSHIP_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  FROZEN: 'frozen',
  CANCELLED: 'cancelled',
} as const

// Plan duration units
export const DURATION_UNITS = {
  DAYS: 'days',
  MONTHS: 'months',
} as const

// Entry validation
export const ENTRY = {
  COOLDOWN_MINUTES: 5, // Minimum time between entries for same affiliate
} as const

// Notification channels
export const NOTIFICATION_CHANNELS = {
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
} as const

// Days before expiry to send notification
export const EXPIRY_NOTIFICATION_DAYS = [7, 3, 1] as const
