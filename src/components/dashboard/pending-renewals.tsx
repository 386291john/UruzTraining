"use client"

import Link from "next/link"
import { AlertTriangle, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"

interface PendingRenewalsProps {
  count: number
  isLoading: boolean
  /** Error message for this specific metric (partial error handling, Req 10.5) */
  error?: string | null
}

/**
 * Alerta de renovaciones pendientes.
 * Muestra el número de afiliados cuya membresía está próxima a vencer
 * y un enlace al reporte de membresías por vencer.
 * Soporta error parcial: muestra indicador de error sin ocultar otras métricas.
 *
 * Validates: Requirements 10.1, 10.5
 */
export function PendingRenewals({ count, isLoading, error }: PendingRenewalsProps) {
  return (
    <Card className="transition-all duration-200">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-4">
        <AlertTriangle className="h-5 w-5 text-foreground/70" />
        <CardTitle className="text-base font-semibold">
          Renovaciones Pendientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-14 w-full" />
        ) : error ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        ) : count === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay membresías próximas a vencer.
          </p>
        ) : (
          <div className="space-y-3">
            <Alert variant="destructive" className="border-border bg-muted text-foreground">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <span className="font-semibold">{count}</span>{" "}
                {count === 1
                  ? "afiliado tiene su membresía próxima a vencer."
                  : "afiliados tienen su membresía próxima a vencer."}
              </AlertDescription>
            </Alert>
            <Link
              href="/reports?tab=expiring"
              className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Ver reporte completo →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
