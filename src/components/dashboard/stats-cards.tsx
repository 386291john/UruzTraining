"use client"

import {
  Users,
  UserCheck,
  UserX,
  DoorOpen,
  Clock,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface StatsCardsProps {
  totalAffiliates?: number
  activeAffiliates?: number
  expiredAffiliates?: number
  todayEntries?: number
  pendingRenewals?: number
  isLoading: boolean
  /** Global error string – shows error indicator on all cards */
  error?: string | null
}

interface StatCardData {
  label: string
  value: number | undefined
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  borderColor: string
}

/**
 * Tarjetas de métricas principales del tablero.
 * Muestra total, activos, expirados, ingresos hoy y renovaciones pendientes.
 * Responsive: 2 columnas en mobile, 3 en tablet, 5 columnas en desktop.
 * Maneja error parcial: muestra indicador de error por métrica afectada (Req 10.5).
 * Usa iconos Lucide: Users, UserCheck, UserX, DoorOpen, Clock.
 *
 * Validates: Requirements 10.1, 10.5, 13.1
 */
export function StatsCards({
  totalAffiliates,
  activeAffiliates,
  expiredAffiliates,
  todayEntries,
  pendingRenewals,
  isLoading,
  error,
}: StatsCardsProps) {
  const stats: StatCardData[] = [
    {
      label: "Total Afiliados",
      value: totalAffiliates,
      icon: Users,
      iconColor: "text-foreground",
      borderColor: "border-l-foreground/80",
    },
    {
      label: "Activos",
      value: activeAffiliates,
      icon: UserCheck,
      iconColor: "text-foreground/80",
      borderColor: "border-l-foreground/60",
    },
    {
      label: "Expirados",
      value: expiredAffiliates,
      icon: UserX,
      iconColor: "text-destructive",
      borderColor: "border-l-destructive",
    },
    {
      label: "Ingresos Hoy",
      value: todayEntries,
      icon: DoorOpen,
      iconColor: "text-foreground/70",
      borderColor: "border-l-foreground/50",
    },
    {
      label: "Renovaciones Pendientes",
      value: pendingRenewals,
      icon: Clock,
      iconColor: "text-foreground/60",
      borderColor: "border-l-foreground/40",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => {
        const Icon = stat.icon
        // Per-metric error: if global error exists, or if the individual value is
        // undefined while not loading, we consider that metric failed
        const hasError = !!error || (!isLoading && stat.value === undefined)

        return (
          <Card
            key={stat.label}
            className={`border-l-4 ${stat.borderColor} transition-all duration-200 hover:shadow-md`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.label}
              </CardTitle>
              <Icon className={`h-4 w-4 ${stat.iconColor} transition-all duration-200`} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : hasError ? (
                <div className="flex items-center gap-1 text-destructive" title={error ?? 'Error al cargar esta métrica'}>
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs">Error</span>
                </div>
              ) : (
                <div className="text-2xl font-bold transition-all duration-200">
                  {stat.value ?? 0}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
