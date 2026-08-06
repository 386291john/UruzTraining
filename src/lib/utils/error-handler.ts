/**
 * Unified Error Handler for Route Handlers
 *
 * Catches unhandled errors in route handlers, logs detailed information
 * server-side, and returns a generic error message to the client.
 *
 * Validates: Requirements 12.6, 12.7
 */

import { NextResponse } from 'next/server'
import { logServerError, type ErrorLogContext } from './logger'

/**
 * Generic internal error response returned to the client.
 * Never includes stack traces, table names, or connection details.
 */
export function internalErrorResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor.',
      },
    },
    { status: 500 }
  )
}

/**
 * Handles an unknown error caught in a route handler.
 * Logs full details server-side and returns a generic client response.
 *
 * @param error - The caught error (unknown type)
 * @param context - Context about the operation being performed
 * @returns A generic 500 JSON response
 */
export function handleRouteError(error: unknown, context: ErrorLogContext): NextResponse {
  logServerError(error, context)
  return internalErrorResponse()
}
