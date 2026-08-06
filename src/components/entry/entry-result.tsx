'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RotateCcw,
} from 'lucide-react'
import type { EntryResult } from '@/hooks/use-entry'

interface EntryResultProps {
  result: EntryResult
  onClear: () => void
}

/**
 * Vista de resultado del control de ingreso.
 * Muestra bienvenida (éxito) o mensaje de error con código visual diferenciado.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 14.4
 */
export function EntryResultView({ result, onClear }: EntryResultProps) {
  if (result.success) {
    return <SuccessView result={result} onClear={onClear} />
  }

  return <ErrorView result={result} onClear={onClear} />
}

function SuccessView({
  result,
  onClear,
}: {
  result: Extract<EntryResult, { success: true }>
  onClear: () => void
}) {
  const { affiliateName, planName, remainingDays, expirationDate } = result.entry

  const formattedDate = new Date(expirationDate).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Card className="w-full max-w-md mx-auto border-border bg-card">
      <CardContent className="pt-8 pb-6 text-center space-y-4">
        <CheckCircle2 className="h-16 w-16 text-foreground/80 mx-auto" />

        <h2 className="text-2xl font-bold text-foreground">
          ¡Bienvenido!
        </h2>

        <div className="space-y-2">
          <p className="text-xl font-semibold text-foreground">
            {affiliateName}
          </p>
          <Badge variant="secondary" className="text-sm">
            {planName}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Días restantes</p>
            <p className="text-2xl font-bold text-foreground">
              {remainingDays === null ? 'Ilimitado' : remainingDays}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Vencimiento</p>
            <p className="text-sm font-medium text-foreground">
              {formattedDate}
            </p>
          </div>
        </div>

        <Button
          onClick={onClear}
          variant="outline"
          className="mt-4 w-full"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Nuevo Ingreso
        </Button>
      </CardContent>
    </Card>
  )
}

/** Error code display configuration */
const errorConfig: Record<
  string,
  {
    icon: typeof XCircle
    title: string
    bgClass: string
    borderClass: string
    iconClass: string
    titleClass: string
  }
> = {
  AFFILIATE_NOT_FOUND: {
    icon: XCircle,
    title: 'Afiliado no encontrado',
    bgClass: 'bg-destructive/10',
    borderClass: 'border-destructive/30',
    iconClass: 'text-destructive',
    titleClass: 'text-destructive',
  },
  PIN_MISMATCH: {
    icon: XCircle,
    title: 'PIN incorrecto',
    bgClass: 'bg-destructive/10',
    borderClass: 'border-destructive/30',
    iconClass: 'text-destructive',
    titleClass: 'text-destructive',
  },
  PIN_BLOCKED: {
    icon: Clock,
    title: 'PIN bloqueado',
    bgClass: 'bg-muted',
    borderClass: 'border-border',
    iconClass: 'text-muted-foreground',
    titleClass: 'text-foreground',
  },
  MEMBERSHIP_EXPIRED: {
    icon: AlertTriangle,
    title: 'Membresía vencida',
    bgClass: 'bg-muted',
    borderClass: 'border-border',
    iconClass: 'text-muted-foreground',
    titleClass: 'text-foreground',
  },
  NO_DAYS_REMAINING: {
    icon: AlertTriangle,
    title: 'Sin días disponibles',
    bgClass: 'bg-muted',
    borderClass: 'border-border',
    iconClass: 'text-muted-foreground',
    titleClass: 'text-foreground',
  },
  ALREADY_ENTERED: {
    icon: AlertTriangle,
    title: 'Ingreso ya registrado hoy',
    bgClass: 'bg-muted',
    borderClass: 'border-border',
    iconClass: 'text-muted-foreground',
    titleClass: 'text-foreground',
  },
}

function ErrorView({
  result,
  onClear,
}: {
  result: Extract<EntryResult, { success: false }>
  onClear: () => void
}) {
  const { code, message, metadata } = result.error

  const defaultError = {
    icon: XCircle,
    title: 'Error',
    bgClass: 'bg-red-50 dark:bg-red-950/30',
    borderClass: 'border-red-300 dark:border-red-800',
    iconClass: 'text-red-600',
    titleClass: 'text-red-800 dark:text-red-300',
  }
  const config = errorConfig[code] ?? defaultError
  const Icon = config.icon

  return (
    <Card
      className={`w-full max-w-md mx-auto ${config.borderClass} ${config.bgClass}`}
    >
      <CardContent className="pt-8 pb-6 text-center space-y-4">
        <Icon className={`h-16 w-16 mx-auto ${config.iconClass}`} />

        <h2 className={`text-2xl font-bold ${config.titleClass}`}>
          {config.title}
        </h2>

        <p className="text-sm text-muted-foreground">{message}</p>

        {/* PIN_MISMATCH: Show remaining attempts */}
        {code === 'PIN_MISMATCH' && metadata?.attemptsRemaining != null && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            Intentos restantes: {metadata.attemptsRemaining}
          </p>
        )}

        {/* PIN_BLOCKED: Show remaining blocked time */}
        {code === 'PIN_BLOCKED' && metadata?.blockedMinutesRemaining != null && (
          <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
            Tiempo restante: {metadata.blockedMinutesRemaining} min
          </p>
        )}

        <Button
          onClick={onClear}
          variant="outline"
          className="mt-4 w-full"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Nuevo Ingreso
        </Button>
      </CardContent>
    </Card>
  )
}
