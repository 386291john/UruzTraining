import { createClient } from '@/lib/supabase/server'

/**
 * Result of a login attempt.
 */
export interface LoginResult {
  success: boolean
  error?: string
  user?: {
    id: string
    email: string
    role: 'admin' | 'instructor'
    fullName: string
  }
}

/**
 * Result of a session check.
 */
export interface SessionResult {
  authenticated: boolean
  user?: {
    id: string
    email: string
    role: 'admin' | 'instructor'
    fullName: string
  }
}

/**
 * Tracks failed login attempts per email address.
 * Used to implement account lockout after consecutive failures.
 */
interface LoginAttemptRecord {
  attempts: number
  blockedUntil: Date | null
}

/**
 * In-memory store for tracking failed login attempts.
 * Note: In a serverless environment (Vercel), this resets on cold starts.
 * For production, consider using Redis or a database table.
 */
const loginAttempts = new Map<string, LoginAttemptRecord>()

/**
 * Default lockout configuration values.
 * These are used as fallbacks if system_config cannot be read.
 */
const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_LOCKOUT_MINUTES = 15

/**
 * Fetches login lockout configuration from the system_config table.
 * Returns default values if the config cannot be read.
 *
 * @returns Object with maxAttempts and lockoutMinutes
 */
async function getLockoutConfig(): Promise<{
  maxAttempts: number
  lockoutMinutes: number
}> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['login_max_attempts', 'login_lockout_minutes'])

    let maxAttempts = DEFAULT_MAX_ATTEMPTS
    let lockoutMinutes = DEFAULT_LOCKOUT_MINUTES

    if (data) {
      for (const row of data) {
        if (row.key === 'login_max_attempts') {
          const val = row.value as { attempts?: number }
          if (val?.attempts && typeof val.attempts === 'number') {
            maxAttempts = val.attempts
          }
        }
        if (row.key === 'login_lockout_minutes') {
          const val = row.value as { minutes?: number }
          if (val?.minutes && typeof val.minutes === 'number') {
            lockoutMinutes = val.minutes
          }
        }
      }
    }

    return { maxAttempts, lockoutMinutes }
  } catch {
    return {
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      lockoutMinutes: DEFAULT_LOCKOUT_MINUTES,
    }
  }
}

/**
 * Checks if the given email is currently blocked from login attempts.
 *
 * @param email - The email address to check
 * @returns True if the email is blocked, false otherwise
 */
function isEmailBlocked(email: string): boolean {
  const record = loginAttempts.get(email.toLowerCase())
  if (!record || !record.blockedUntil) {
    return false
  }

  if (new Date() >= record.blockedUntil) {
    // Block period has expired, reset
    loginAttempts.delete(email.toLowerCase())
    return false
  }

  return true
}

/**
 * Records a failed login attempt for the given email.
 * If the maximum number of attempts is reached, blocks the email
 * for the configured lockout duration.
 *
 * @param email - The email address that failed authentication
 * @param maxAttempts - Maximum allowed attempts before lockout
 * @param lockoutMinutes - Duration of lockout in minutes
 */
function recordFailedAttempt(
  email: string,
  maxAttempts: number,
  lockoutMinutes: number
): void {
  const key = email.toLowerCase()
  const record = loginAttempts.get(key) || { attempts: 0, blockedUntil: null }

  record.attempts += 1

  if (record.attempts >= maxAttempts) {
    record.blockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000)
  }

  loginAttempts.set(key, record)
}

/**
 * Resets the failed login attempt counter for the given email.
 * Called on successful authentication.
 *
 * @param email - The email address to reset
 */
function resetAttempts(email: string): void {
  loginAttempts.delete(email.toLowerCase())
}

/**
 * Authenticates a user with email and password.
 * Implements failed attempt tracking and account lockout.
 *
 * - Returns a generic error message without revealing which field is incorrect.
 * - Blocks login after configured max attempts for configured lockout duration.
 * - On success, fetches user role from the profiles table.
 *
 * Validates: Requirements 1.1, 1.2, 1.7
 *
 * @param email - User email address
 * @param password - User password
 * @returns LoginResult with success status and user data or error
 */
export async function login(
  email: string,
  password: string
): Promise<LoginResult> {
  const { maxAttempts, lockoutMinutes } = await getLockoutConfig()

  // Check if the email is currently blocked
  if (isEmailBlocked(email)) {
    return {
      success: false,
      error: 'Cuenta temporalmente bloqueada por múltiples intentos fallidos. Intente nuevamente en unos minutos.',
    }
  }

  const supabase = createClient()

  // Attempt authentication via Supabase Auth
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    })

  if (authError || !authData.user) {
    // Record the failed attempt
    recordFailedAttempt(email, maxAttempts, lockoutMinutes)

    return {
      success: false,
      error: 'Credenciales inválidas. Verifique su correo electrónico y contraseña.',
    }
  }

  // Successful login - reset attempt counter
  resetAttempts(email)

  // Fetch user role from profiles table
  const role = await getUserRole(authData.user.id)

  if (!role) {
    // User has no profile/role - sign them out
    await supabase.auth.signOut()
    return {
      success: false,
      error: 'No se encontró un perfil asociado a esta cuenta. Contacte al administrador.',
    }
  }

  // Fetch full name from profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', authData.user.id)
    .single()

  return {
    success: true,
    user: {
      id: authData.user.id,
      email: authData.user.email!,
      role,
      fullName: profile?.full_name ?? '',
    },
  }
}

/**
 * Signs out the currently authenticated user.
 * Clears the session cookie.
 *
 * Validates: Requirements 1.1
 */
export async function logout(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
}

/**
 * Retrieves the current authenticated session.
 * Returns user data with role if authenticated, or unauthenticated status.
 *
 * Validates: Requirements 1.5
 *
 * @returns SessionResult with authentication status and user data
 */
export async function getSession(): Promise<SessionResult> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { authenticated: false }
  }

  const role = await getUserRole(user.id)

  if (!role) {
    return { authenticated: false }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  return {
    authenticated: true,
    user: {
      id: user.id,
      email: user.email!,
      role,
      fullName: profile?.full_name ?? '',
    },
  }
}

/**
 * Fetches the role of a user from the profiles table.
 *
 * @param userId - The user's UUID from Supabase Auth
 * @returns The user's role ('admin' | 'instructor') or null if not found
 */
export async function getUserRole(
  userId: string
): Promise<'admin' | 'instructor' | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return null
  }

  const role = data.role as string
  if (role === 'admin' || role === 'instructor') {
    return role
  }

  return null
}

/**
 * Returns the number of remaining minutes until the lockout expires
 * for the given email. Returns 0 if not blocked.
 *
 * @param email - The email address to check
 * @returns Minutes remaining in lockout, or 0 if not blocked
 */
export function getRemainingLockoutMinutes(email: string): number {
  const record = loginAttempts.get(email.toLowerCase())
  if (!record || !record.blockedUntil) {
    return 0
  }

  const remaining = record.blockedUntil.getTime() - Date.now()
  if (remaining <= 0) {
    loginAttempts.delete(email.toLowerCase())
    return 0
  }

  return Math.ceil(remaining / (60 * 1000))
}

/**
 * Exposes the login attempts map for testing purposes only.
 * @internal
 */
export const _testHelpers = {
  loginAttempts,
  resetAllAttempts: () => loginAttempts.clear(),
}
