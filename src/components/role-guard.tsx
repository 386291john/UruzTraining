'use client'

import { type ReactNode } from 'react'
import { useAuth } from '@/hooks/use-auth'

export type AllowedRole = 'admin' | 'instructor'

interface RoleGuardProps {
  /** Roles that are allowed to see the children content */
  allowedRoles: AllowedRole[]
  /** Content to render when the user's role matches */
  children: ReactNode
  /** Optional fallback to render when the user's role doesn't match (defaults to null) */
  fallback?: ReactNode
}

/**
 * Component that conditionally renders children based on the user's role.
 * Uses the useAuth hook to check the current user's role against allowedRoles.
 *
 * Example usage:
 * ```tsx
 * <RoleGuard allowedRoles={['admin']}>
 *   <Button variant="destructive">Eliminar</Button>
 * </RoleGuard>
 * ```
 *
 * Validates: Requirements 1.3, 1.4
 */
export function RoleGuard({
  allowedRoles,
  children,
  fallback = null,
}: RoleGuardProps) {
  const { user } = useAuth()

  // If user is not loaded yet or has no role, don't render children
  if (!user || !user.role) {
    return <>{fallback}</>
  }

  // Check if the user's role is in the allowed list
  if (!allowedRoles.includes(user.role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
