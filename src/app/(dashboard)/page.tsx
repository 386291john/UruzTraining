"use client"

import { useDashboard } from "@/hooks/use-dashboard"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { BirthdaysList } from "@/components/dashboard/birthdays-list"
import { PendingRenewals } from "@/components/dashboard/pending-renewals"
import { TopPlans } from "@/components/dashboard/top-plans"

/**
 * Página principal del tablero.
 * Muestra métricas, cumpleaños, renovaciones pendientes y top planes.
 * Layout: Stats cards grid (responsive 2 cols mobile, 5 cols desktop),
 * luego 2-column grid: izquierda (cumpleaños + renovaciones pendientes), derecha (top planes).
 *
 * Maneja error parcial: si una métrica falla, muestra indicador de error en esa
 * métrica sin ocultar las demás que sí cargaron correctamente (Req 10.5).
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 13.4
 */
export default function DashboardPage() {
  const { data, isLoading, metricErrors } = useDashboard()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tablero</h2>
        <p className="text-muted-foreground">
          Resumen general de tu gimnasio.
        </p>
      </div>

      {/* Stat cards - responsive: 2 cols mobile, 3 cols tablet, 5 cols desktop */}
      <StatsCards
        totalAffiliates={data?.totalAffiliates}
        activeAffiliates={data?.activeAffiliates}
        expiredAffiliates={data?.expiredAffiliates}
        todayEntries={data?.todayEntries}
        pendingRenewals={data?.pendingRenewals}
        isLoading={isLoading}
        error={metricErrors.stats}
      />

      {/* Bottom section: 2-column grid (responsive) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 transition-all duration-200">
        {/* Left column: birthdays + pending renewals */}
        <div className="space-y-6">
          <BirthdaysList
            birthdays={data?.todayBirthdays ?? []}
            isLoading={isLoading}
            error={metricErrors.birthdays}
          />
          <PendingRenewals
            count={data?.pendingRenewals ?? 0}
            isLoading={isLoading}
            error={metricErrors.pendingRenewals}
          />
        </div>

        {/* Right column: top plans */}
        <div>
          <TopPlans
            plans={data?.topPlans ?? []}
            isLoading={isLoading}
            error={metricErrors.topPlans}
          />
        </div>
      </div>
    </div>
  )
}
