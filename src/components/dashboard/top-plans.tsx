"use client"

import { Trophy, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { TopPlan } from "@/hooks/use-dashboard"

interface TopPlansProps {
  plans: TopPlan[]
  isLoading: boolean
  /** Error message for this specific metric (partial error handling, Req 10.5) */
  error?: string | null
}

/**
 * Ranking de los top 5 planes más populares con visualización tipo barra.
 * Muestra nombre del plan y barra proporcional basada en la cantidad de membresías activas.
 * Soporta error parcial: muestra indicador de error sin ocultar otras métricas.
 *
 * Validates: Requirements 10.1, 10.5
 */
export function TopPlans({ plans, isLoading, error }: TopPlansProps) {
  // Calculate max count for bar proportions
  const maxCount = plans.length > 0 ? Math.max(...plans.map((p) => p.activeCount)) : 1

  return (
    <Card className="transition-all duration-200">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-4">
        <Trophy className="h-5 w-5 text-foreground/70" />
        <CardTitle className="text-base font-semibold">
          Top 5 Planes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        ) : plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay planes activos registrados.
          </p>
        ) : (
          <ol className="space-y-3">
            {plans.map((plan, index) => {
              const barWidth = maxCount > 0 ? (plan.activeCount / maxCount) * 100 : 0

              return (
                <li
                  key={plan.planId}
                  className="space-y-1 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium">{plan.planName}</span>
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground">
                      {plan.activeCount}
                    </span>
                  </div>
                  {/* Bar-like display */}
                  <div className="ml-8 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground/70 transition-all duration-200"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
