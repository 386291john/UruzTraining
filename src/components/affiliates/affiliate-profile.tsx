'use client'

import { useState, useEffect } from 'react'
import { UserCircle, Key, RefreshCw } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAffiliates, type AffiliateProfile as AffiliateProfileType } from '@/hooks/use-affiliates'
import { usePlans, type Plan } from '@/hooks/use-plans'

const pinSchema = z.object({
  pin: z
    .string()
    .length(4, 'El PIN debe ser exactamente 4 dígitos.')
    .regex(/^\d{4}$/, 'El PIN debe ser numérico de 4 dígitos.'),
})

type PinFormValues = z.infer<typeof pinSchema>

const renewalSchema = z.object({
  newPlanId: z.string().min(1, 'Debe seleccionar un plan.'),
  newInstructorId: z.string().optional(),
  observations: z
    .string()
    .max(500, 'Las observaciones no pueden exceder 500 caracteres.')
    .optional(),
})

type RenewalFormValues = z.infer<typeof renewalSchema>

interface AffiliateProfileProps {
  profile: AffiliateProfileType
  onPinUpdated?: () => void
  onRenewed?: () => void
}

/**
 * Displays affiliate profile info, active membership, PIN management,
 * renewal dialog, and renewal history.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.6, 4.7, 4.8, 7.1, 8.1, 8.4, 8.6, 13.4
 */
export function AffiliateProfile({ profile, onPinUpdated, onRenewed }: AffiliateProfileProps) {
  const { updatePin, renewAffiliate } = useAffiliates()
  const { plans, fetchPlans } = usePlans()
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [renewDialogOpen, setRenewDialogOpen] = useState(false)
  const [expirationDialogOpen, setExpirationDialogOpen] = useState(false)
  const [newExpirationDate, setNewExpirationDate] = useState('')
  const [isSavingExpiration, setIsSavingExpiration] = useState(false)
  const [isUpdatingPin, setIsUpdatingPin] = useState(false)
  const [isRenewing, setIsRenewing] = useState(false)

  // Filter only active plans for the renewal selector
  const activePlans = plans.filter((plan: Plan) => plan.status === 'active')

  const pinForm = useForm<PinFormValues>({
    resolver: zodResolver(pinSchema) as any,
    defaultValues: { pin: '' },
  })

  const renewalForm = useForm<RenewalFormValues>({
    resolver: zodResolver(renewalSchema) as any,
    defaultValues: {
      newPlanId: '',
      newInstructorId: '',
      observations: '',
    },
  })

  // Fetch plans when renewal dialog opens
  useEffect(() => {
    if (renewDialogOpen) {
      fetchPlans(1)
    }
  }, [renewDialogOpen, fetchPlans])

  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—'
    // For date-only strings (YYYY-MM-DD), split and construct to avoid timezone shift
    const parts = dateStr.split('T')[0].split('-')
    if (parts.length === 3) {
      const [year, month, day] = parts
      return `${parseInt(day)}/${parseInt(month)}/${year}`
    }
    return new Date(dateStr).toLocaleDateString('es-CO')
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'active':
        return <Badge variant="default">Activa</Badge>
      case 'expired':
        return <Badge variant="secondary">Vencida</Badge>
      case 'no_membership':
        return <Badge variant="outline">Sin membresía</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  function getDaysRemainingText(): string {
    if (!profile.membership) return '—'
    if (profile.membership.allowed_days === null) return 'Ilimitado'
    if (profile.membership.days_remaining === null) return '—'
    return `${profile.membership.days_remaining} día${profile.membership.days_remaining !== 1 ? 's' : ''}`
  }

  async function handlePinSubmit(values: PinFormValues) {
    setIsUpdatingPin(true)
    const success = await updatePin(profile.id, values.pin)
    setIsUpdatingPin(false)

    if (success) {
      setPinDialogOpen(false)
      pinForm.reset()
      onPinUpdated?.()
    }
  }

  async function handleRenewalSubmit(values: RenewalFormValues) {
    setIsRenewing(true)
    const success = await renewAffiliate(profile.id, {
      newPlanId: values.newPlanId,
      newInstructorId: values.newInstructorId || undefined,
      observations: values.observations || undefined,
    })
    setIsRenewing(false)

    if (success) {
      setRenewDialogOpen(false)
      renewalForm.reset()
      onRenewed?.()
    }
  }

  async function handleSaveExpiration() {
    if (!newExpirationDate) return
    setIsSavingExpiration(true)
    try {
      const res = await fetch(`/api/affiliates/${profile.id}/membership`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiration_date: newExpirationDate }),
      })
      const json = await res.json()
      if (json.success) {
        setExpirationDialogOpen(false)
        onRenewed?.() // Refresh profile
      }
    } catch {
      // silent
    } finally {
      setIsSavingExpiration(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Affiliate Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <UserCircle className="h-8 w-8 text-muted-foreground" />
            <div>
              <CardTitle className="text-xl">{profile.full_name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Documento: {profile.document_id}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Celular</p>
              <p>{profile.phone || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fecha de nacimiento</p>
              <p>{formatDate(profile.birth_date)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fecha de registro</p>
              <p>{formatDate(profile.created_at)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Instructor</p>
              <p>{profile.instructor_id ? 'Asignado' : '—'}</p>
            </div>
          </div>

          {/* Observations */}
          {profile.observations && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground">Observaciones</p>
              <p className="mt-1 text-sm">{profile.observations}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Membership */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Membresía</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.membership ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Plan</p>
                  <p>{profile.membership.plan_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Estado</p>
                  {getStatusBadge(profile.membership.status)}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Días restantes</p>
                  <p>{getDaysRemainingText()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Vencimiento</p>
                  <div className="flex items-center gap-2">
                    <p>{formatDate(profile.membership.expiration_date)}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        setNewExpirationDate(profile.membership?.expiration_date || '')
                        setExpirationDialogOpen(true)
                      }}
                    >
                      Editar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Sin membresía activa.</p>
          )}
        </CardContent>
      </Card>

      {/* Renewal History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Historial de Renovaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.renewal_history && profile.renewal_history.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Plan anterior</TableHead>
                  <TableHead>Plan nuevo</TableHead>
                  <TableHead>Instructor</TableHead>
                  <TableHead>Días no usados</TableHead>
                  <TableHead>Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profile.renewal_history.map((entry, index) => (
                  <TableRow key={index}>
                    <TableCell>{formatDate(entry.renewed_at)}</TableCell>
                    <TableCell>{entry.previous_plan_name}</TableCell>
                    <TableCell>{entry.new_plan_name}</TableCell>
                    <TableCell>{entry.instructor_id || '—'}</TableCell>
                    <TableCell>{entry.unused_days !== null ? entry.unused_days : '—'}</TableCell>
                    <TableCell>{entry.observations || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">Sin renovaciones anteriores.</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => setPinDialogOpen(true)}
        >
          <Key className="mr-2 h-4 w-4" />
          Actualizar PIN
        </Button>
        <Button
          variant="outline"
          onClick={() => setRenewDialogOpen(true)}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Renovar
        </Button>
      </div>

      {/* PIN Update Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Actualizar PIN</DialogTitle>
            <DialogDescription>
              Ingresa el nuevo PIN de 4 dígitos para {profile.full_name}.
            </DialogDescription>
          </DialogHeader>

          <Form {...pinForm}>
            <form onSubmit={pinForm.handleSubmit(handlePinSubmit)} className="space-y-4">
              <FormField
                control={pinForm.control}
                name="pin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nuevo PIN</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••"
                        maxLength={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPinDialogOpen(false)
                    pinForm.reset()
                  }}
                  disabled={isUpdatingPin}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isUpdatingPin}>
                  {isUpdatingPin ? 'Actualizando...' : 'Actualizar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Renewal Dialog */}
      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Renovar Membresía</DialogTitle>
            <DialogDescription>
              Selecciona el nuevo plan para {profile.full_name}. Solo se muestran planes activos.
            </DialogDescription>
          </DialogHeader>

          <Form {...renewalForm}>
            <form onSubmit={renewalForm.handleSubmit(handleRenewalSubmit)} className="space-y-4">
              <FormField
                control={renewalForm.control}
                name="newPlanId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar plan" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activePlans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name} — ${plan.price.toLocaleString('es-CO')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={renewalForm.control}
                name="newInstructorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructor (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ID del instructor (dejar vacío para mantener actual)"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={renewalForm.control}
                name="observations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Notas sobre la renovación..."
                        maxLength={500}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRenewDialogOpen(false)
                    renewalForm.reset()
                  }}
                  disabled={isRenewing}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isRenewing}>
                  {isRenewing ? 'Renovando...' : 'Renovar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Expiration Date Edit Dialog */}
      <Dialog open={expirationDialogOpen} onOpenChange={setExpirationDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Editar fecha de vencimiento</DialogTitle>
            <DialogDescription>
              Ajusta la fecha de fin del plan para {profile.full_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="expiration_date" className="text-sm font-medium">
                Nueva fecha de vencimiento
              </label>
              <Input
                id="expiration_date"
                type="date"
                value={newExpirationDate}
                onChange={(e) => setNewExpirationDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExpirationDialogOpen(false)}
              disabled={isSavingExpiration}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveExpiration}
              disabled={isSavingExpiration || !newExpirationDate}
            >
              {isSavingExpiration ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
