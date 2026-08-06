'use client'

import { Edit } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { Plan } from '@/hooks/use-plans'

interface PlanListProps {
  plans: Plan[]
  isLoading: boolean
  onEdit: (plan: Plan) => void
  onDelete?: (id: string) => Promise<boolean>
}

/**
 * Displays a list of plans in a table (desktop) or cards (mobile).
 * Only edit is available — plans cannot be deleted, only deactivated via edit.
 *
 * Validates: Requirements 2.3, 2.4, 13.4
 */
export function PlanList({ plans, isLoading, onEdit }: PlanListProps) {
  function formatPrice(price: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Cargando planes...</p>
      </div>
    )
  }

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No hay planes registrados.</p>
        <p className="text-sm text-muted-foreground">
          Crea tu primer plan para comenzar.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Días</TableHead>
              <TableHead>Vigencia (semanas)</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell>
                  {plan.allowed_days === null ? (
                    <Badge variant="secondary">Ilimitado</Badge>
                  ) : (
                    plan.allowed_days
                  )}
                </TableCell>
                <TableCell>{plan.vigency_weeks}</TableCell>
                <TableCell>{formatPrice(plan.price)}</TableCell>
                <TableCell>
                  <Badge
                    variant={plan.status === 'active' ? 'default' : 'secondary'}
                  >
                    {plan.status === 'active' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(plan)}
                    aria-label={`Editar plan ${plan.name}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card view */}
      <div className="grid gap-3 md:hidden">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{plan.name}</CardTitle>
                <Badge
                  variant={plan.status === 'active' ? 'default' : 'secondary'}
                >
                  {plan.status === 'active' ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Días: </span>
                  {plan.allowed_days === null ? (
                    <Badge variant="secondary" className="text-xs">Ilimitado</Badge>
                  ) : (
                    plan.allowed_days
                  )}
                </div>
                <div>
                  <span className="font-medium text-foreground">Vigencia: </span>
                  {plan.vigency_weeks} sem.
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-foreground">Precio: </span>
                  {formatPrice(plan.price)}
                </div>
              </div>
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(plan)}
                >
                  <Edit className="mr-1 h-3 w-3" />
                  Editar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
