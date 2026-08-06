'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Dashboard data types matching API response shape.
 */
export interface BirthdayAffiliate {
  id: string
  fullName: string
  birthDate: string
  phone: string
}

export interface TopPlan {
  planId: string
  planName: string
  activeCount: number
}

export interface DashboardData {
  totalAffiliates: number
  activeAffiliates: number
  expiredAffiliates: number
  todayEntries: number
  pendingRenewals: number
  todayBirthdays: BirthdayAffiliate[]
  topPlans: TopPlan[]
}

/**
 * Per-metric error indicators.
 * Allows showing error on individual metrics while keeping others visible.
 * Validates: Requirement 10.5
 */
export interface DashboardMetricErrors {
  stats: string | null
  birthdays: string | null
  pendingRenewals: string | null
  topPlans: string | null
}

interface UseDashboardReturn {
  data: DashboardData | null
  isLoading: boolean
  /** Global error when the entire request fails */
  error: string | null
  /** Per-metric error indicators for partial failure handling */
  metricErrors: DashboardMetricErrors
  refetch: () => Promise<void>
}

/**
 * Hook para obtener las métricas del tablero principal.
 * Consume GET /api/dashboard y maneja estados de carga y error.
 * Soporta error parcial: si una métrica falla se muestra indicador de error
 * en esa métrica sin ocultar las demás (Req 10.5).
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */
export function useDashboard(): UseDashboardReturn {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metricErrors, setMetricErrors] = useState<DashboardMetricErrors>({
    stats: null,
    birthdays: null,
    pendingRenewals: null,
    topPlans: null,
  })

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setMetricErrors({
      stats: null,
      birthdays: null,
      pendingRenewals: null,
      topPlans: null,
    })

    try {
      const res = await fetch('/api/dashboard')
      const json = await res.json()

      if (!res.ok || !json.success) {
        const msg = json.error?.message || 'Error al obtener métricas del tablero.'
        setError(msg)
        // Set all metric errors when the global request fails
        setMetricErrors({
          stats: msg,
          birthdays: msg,
          pendingRenewals: msg,
          topPlans: msg,
        })
        return
      }

      const dashboardData = json.data as DashboardData

      // Validate individual metric groups and set partial errors if data is malformed
      const newMetricErrors: DashboardMetricErrors = {
        stats: null,
        birthdays: null,
        pendingRenewals: null,
        topPlans: null,
      }

      // Check stats metrics
      if (
        dashboardData.totalAffiliates === undefined ||
        dashboardData.activeAffiliates === undefined ||
        dashboardData.expiredAffiliates === undefined ||
        dashboardData.todayEntries === undefined ||
        dashboardData.pendingRenewals === undefined
      ) {
        newMetricErrors.stats = 'No se pudieron cargar las métricas de resumen.'
      }

      // Check birthdays
      if (!Array.isArray(dashboardData.todayBirthdays)) {
        newMetricErrors.birthdays = 'No se pudieron cargar los cumpleaños.'
      }

      // Check pending renewals (uses same pendingRenewals count from stats)
      if (dashboardData.pendingRenewals === undefined) {
        newMetricErrors.pendingRenewals = 'No se pudieron cargar las renovaciones pendientes.'
      }

      // Check top plans
      if (!Array.isArray(dashboardData.topPlans)) {
        newMetricErrors.topPlans = 'No se pudieron cargar los planes populares.'
      }

      setMetricErrors(newMetricErrors)
      setData(dashboardData)
    } catch {
      const connectionError = 'Error de conexión al obtener métricas del tablero.'
      setError(connectionError)
      setMetricErrors({
        stats: connectionError,
        birthdays: connectionError,
        pendingRenewals: connectionError,
        topPlans: connectionError,
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  return {
    data,
    isLoading,
    error,
    metricErrors,
    refetch: fetchDashboard,
  }
}
