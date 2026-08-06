'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'instructor'
  fullName: string
}

interface UseAuthReturn {
  user: AuthUser | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

/**
 * Hook para gestionar autenticación del usuario.
 * Verifica sesión al montar, provee login/logout, y maneja estados de carga y error.
 *
 * Validates: Requirements 1.1, 1.2, 1.7
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Check session on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session')
        if (res.ok) {
          const json = await res.json()
          if (json.success && json.data?.user) {
            setUser(json.data.user)
          }
        }
      } catch {
        // Session check failed silently — user remains unauthenticated
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true)
      setError(null)

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })

        const json = await res.json()

        if (res.status === 429) {
          setError(
            'Cuenta temporalmente bloqueada por múltiples intentos fallidos. Intente nuevamente en unos minutos.'
          )
          return
        }

        if (!res.ok || !json.success) {
          setError(
            json.error?.message || 'Credenciales inválidas'
          )
          return
        }

        setUser(json.data.user)
        router.push('/')
      } catch {
        setError('Error de conexión. Intente nuevamente.')
      } finally {
        setIsLoading(false)
      }
    },
    [router]
  )

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Logout request failed — proceed with client-side cleanup
    } finally {
      setUser(null)
      setIsLoading(false)
      router.push('/login')
    }
  }, [router])

  return { user, isLoading, error, login, logout }
}
