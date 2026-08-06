'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Entry validation result types for the check-in flow.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

export interface EntrySuccess {
  success: true
  entry: {
    affiliateName: string
    planName: string
    remainingDays: number | null // null = unlimited
    expirationDate: string
  }
}

export interface EntryError {
  success: false
  error: {
    code:
      | 'AFFILIATE_NOT_FOUND'
      | 'PIN_MISMATCH'
      | 'PIN_BLOCKED'
      | 'MEMBERSHIP_EXPIRED'
      | 'NO_DAYS_REMAINING'
      | 'ALREADY_ENTERED'
    message: string
    metadata?: {
      attemptsRemaining?: number
      blockedMinutesRemaining?: number
    }
  }
}

export type EntryResult = EntrySuccess | EntryError

interface UseEntryReturn {
  validateEntry: (documentId: string, pin: string) => Promise<void>
  lastResult: EntryResult | null
  isProcessing: boolean
  clearResult: () => void
}

const AUTO_CLEAR_MS = 5_000

/**
 * Hook para gestionar el flujo de control de ingreso.
 * Llama al endpoint POST /api/entry y gestiona el estado del resultado.
 * Auto-limpia el resultado después de 5 segundos para volver al modo formulario.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 13.4, 14.4
 */
export function useEntry(): UseEntryReturn {
  const [lastResult, setLastResult] = useState<EntryResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const clearResult = useCallback(() => {
    setLastResult(null)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startAutoClear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      setLastResult(null)
      timerRef.current = null
    }, AUTO_CLEAR_MS)
  }, [])

  const validateEntry = useCallback(
    async (documentId: string, pin: string) => {
      setIsProcessing(true)
      setLastResult(null)

      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }

      try {
        const res = await fetch('/api/entry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_id: documentId, pin }),
        })

        const json = await res.json()

        // Map API response shape to EntryResult shape
        let mapped: EntryResult
        if (json.success && json.data) {
          mapped = {
            success: true,
            entry: {
              affiliateName: json.data.affiliateName,
              planName: json.data.planName,
              remainingDays: json.data.remainingDays,
              expirationDate: json.data.expirationDate,
            },
          }
        } else if (!json.success && json.error) {
          mapped = {
            success: false,
            error: {
              code: json.error.code || 'AFFILIATE_NOT_FOUND',
              message: json.error.message || 'Error desconocido.',
              metadata: json.error.metadata,
            },
          }
        } else {
          mapped = json as EntryResult
        }

        setLastResult(mapped)
        startAutoClear()
      } catch {
        setLastResult({
          success: false,
          error: {
            code: 'AFFILIATE_NOT_FOUND',
            message: 'Error de conexión. Intente nuevamente.',
          },
        })
        startAutoClear()
      } finally {
        setIsProcessing(false)
      }
    },
    [startAutoClear]
  )

  return { validateEntry, lastResult, isProcessing, clearResult }
}
