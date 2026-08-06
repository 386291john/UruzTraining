/**
 * Server-side Error Logger
 *
 * Logs detailed error information (stack trace, operation, timestamp, request context)
 * to the server console only. Never exposes internal details to the client.
 *
 * Validates: Requirements 12.6
 */

export interface ErrorLogContext {
  /** The operation that was being performed when the error occurred */
  operation: string
  /** The user ID (if available) performing the operation */
  userId?: string
  /** The HTTP method of the request */
  method?: string
  /** The URL path of the request */
  path?: string
  /** Additional metadata relevant to the error */
  metadata?: Record<string, unknown>
}

interface ErrorLogEntry {
  timestamp: string
  level: 'error' | 'warn'
  operation: string
  message: string
  stack?: string
  userId?: string
  method?: string
  path?: string
  metadata?: Record<string, unknown>
}

/**
 * Logs a server-side error with full context.
 * This function logs to console.error with structured information
 * including timestamp, operation, stack trace, and request context.
 *
 * IMPORTANT: This is only for server-side use. Never send this information to the client.
 *
 * @param error - The error object or unknown thrown value
 * @param context - Contextual information about the operation
 */
export function logServerError(error: unknown, context: ErrorLogContext): void {
  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    operation: context.operation,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    userId: context.userId,
    method: context.method,
    path: context.path,
    metadata: context.metadata,
  }

  console.error('[UruzTraining Error]', JSON.stringify(entry, null, 2))
}

/**
 * Logs a server-side warning with context.
 * Used for non-critical issues that don't prevent operation completion.
 *
 * @param message - The warning message
 * @param context - Contextual information
 */
export function logServerWarning(message: string, context: ErrorLogContext): void {
  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'warn',
    operation: context.operation,
    message,
    userId: context.userId,
    method: context.method,
    path: context.path,
    metadata: context.metadata,
  }

  console.warn('[UruzTraining Warning]', JSON.stringify(entry, null, 2))
}
