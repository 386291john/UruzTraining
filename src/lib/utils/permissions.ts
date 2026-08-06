/**
 * Server-side permission utilities for role-based access control.
 * Two roles: admin (full access) and instructor (no delete, no manage_settings).
 *
 * Validates: Requirements 1.3, 1.4
 */

export type UserRole = 'admin' | 'instructor'

export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'manage_settings'

/**
 * Permission matrix defining which roles can perform which actions.
 */
const PERMISSIONS: Record<UserRole, Set<PermissionAction>> = {
  admin: new Set<PermissionAction>(['create', 'read', 'update', 'delete', 'manage_settings']),
  instructor: new Set<PermissionAction>(['create', 'read', 'update']),
}

/**
 * Checks if a given role has permission to perform the specified action.
 *
 * @param role - The user's role
 * @param action - The action to check
 * @returns true if the role is allowed to perform the action
 */
export function checkPermission(role: string, action: string): boolean {
  const allowedActions = PERMISSIONS[role as UserRole]
  if (!allowedActions) {
    return false
  }
  return allowedActions.has(action as PermissionAction)
}

/**
 * Error thrown when a permission check fails.
 */
export class PermissionDeniedError extends Error {
  public readonly statusCode = 403

  constructor(role: string, action: string) {
    super(
      `El rol '${role}' no tiene permiso para realizar la acción '${action}'.`
    )
    this.name = 'PermissionDeniedError'
  }
}

/**
 * Asserts that the given role has permission to perform the action.
 * Throws PermissionDeniedError if denied.
 *
 * @param role - The user's role
 * @param action - The action to assert permission for
 * @throws PermissionDeniedError if the role cannot perform the action
 */
export function assertPermission(role: string, action: string): void {
  if (!checkPermission(role, action)) {
    throw new PermissionDeniedError(role, action)
  }
}

/**
 * Wraps a Next.js Route Handler with role verification.
 * If the user's role is not in allowedRoles, returns a 403 response.
 *
 * Usage:
 * ```ts
 * export const DELETE = withRoleCheck(async (request, context) => {
 *   // handler logic
 * }, ['admin'])
 * ```
 *
 * @param handler - The route handler function to wrap
 * @param allowedRoles - Array of roles permitted to access this handler
 * @returns A wrapped handler that checks role before executing
 */
export function withRoleCheck<
  TArgs extends unknown[],
>(
  handler: (
    request: Request,
    ...args: TArgs
  ) => Promise<Response>,
  allowedRoles: UserRole[]
): (request: Request, ...args: TArgs) => Promise<Response> {
  return async (request: Request, ...args: TArgs): Promise<Response> => {
    // Import dynamically to avoid circular deps in module resolution
    const { getAuthenticatedUser, forbiddenResponse, unauthorizedResponse } =
      await import('./api-helpers')

    const authResult = await getAuthenticatedUser()

    if (!authResult) {
      return unauthorizedResponse()
    }

    if (!allowedRoles.includes(authResult.role as UserRole)) {
      return forbiddenResponse()
    }

    return handler(request, ...args)
  }
}
