'use client'

import { useState, useCallback } from 'react'

/**
 * Report types mapped to their respective API endpoints.
 */
export type ReportType =
  | 'entries'
  | 'renewals'
  | 'expired'
  | 'active'
  | 'expiring'
  | 'entries-by-day'
  | 'entries-by-month'

/** Filters that can be applied to report requests */
export interface ReportFilters {
  dateFrom?: string
  dateTo?: string
  affiliateId?: string
  instructorId?: string
}

interface UseReportsReturn {
  data: Record<string, unknown>[]
  isLoading: boolean
  error: string | null
  message: string | null
  fetchReport: (type: ReportType, filters?: ReportFilters) => Promise<void>
}

/**
 * Hook para obtener informes desde los endpoints /api/reports/*.
 * Soporta todos los tipos de informe con filtros opcionales.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8
 */
export function useReports(): UseReportsReturn {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const fetchReport = useCallback(async (type: ReportType, filters?: ReportFilters) => {
    setIsLoading(true)
    setError(null)
    setMessage(null)
    setData([])

    try {
      const params = new URLSearchParams()

      if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters?.dateTo) params.set('dateTo', filters.dateTo)
      if (filters?.affiliateId) params.set('affiliateId', filters.affiliateId)
      if (filters?.instructorId) params.set('instructorId', filters.instructorId)

      const queryString = params.toString()
      const url = `/api/reports/${type}${queryString ? `?${queryString}` : ''}`

      const res = await fetch(url)
      const json = await res.json()

      if (!res.ok || !json.success) {
        const msg = json.error?.message || 'Error al obtener el informe.'
        setError(msg)
        return
      }

      setData(json.data ?? [])
      if (json.message) {
        setMessage(json.message)
      }
    } catch {
      setError('Error de conexión al obtener el informe.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    data,
    isLoading,
    error,
    message,
    fetchReport,
  }
}
