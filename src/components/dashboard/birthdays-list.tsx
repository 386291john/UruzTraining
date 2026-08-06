"use client"

import { Cake, Phone, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { BirthdayAffiliate } from "@/hooks/use-dashboard"

interface BirthdaysListProps {
  birthdays: BirthdayAffiliate[]
  isLoading: boolean
  /** Error message for this specific metric (partial error handling, Req 10.5) */
  error?: string | null
}

/**
 * Lista de cumpleañeros del día.
 * Muestra nombre y teléfono de los afiliados que cumplen años hoy.
 * Soporta error parcial: muestra indicador de error sin ocultar otras métricas.
 *
 * Validates: Requirements 10.1, 10.5
 */
export function BirthdaysList({ birthdays, isLoading, error }: BirthdaysListProps) {
  return (
    <Card className="transition-all duration-200">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-4">
        <Cake className="h-5 w-5 text-foreground/70" />
        <CardTitle className="text-base font-semibold">
          Cumpleaños de Hoy
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        ) : birthdays.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin cumpleaños hoy.
          </p>
        ) : (
          <ul className="space-y-3">
            {birthdays.map((affiliate) => (
              <li
                key={affiliate.id}
                className="flex items-center justify-between rounded-md border p-3 transition-all duration-200 hover:bg-muted/50"
              >
                <span className="text-sm font-medium">
                  {affiliate.fullName}
                </span>
                {affiliate.phone && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {affiliate.phone}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
