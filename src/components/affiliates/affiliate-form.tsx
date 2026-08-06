'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAffiliates } from '@/hooks/use-affiliates'

/**
 * Zod schema for affiliate registration form.
 * document_id: 5-15 digits, full_name: 3-100 chars, pin: 4 digits,
 * birth_date: not in future, phone: 7-15 digits, plan_id: required.
 */
const affiliateFormSchema = z.object({
  document_id: z
    .string()
    .min(5, 'El documento debe tener al menos 5 dígitos.')
    .max(15, 'El documento no puede exceder 15 dígitos.')
    .regex(/^\d+$/, 'Solo dígitos numéricos.'),
  full_name: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres.')
    .max(100, 'El nombre no puede exceder 100 caracteres.'),
  pin: z
    .string()
    .length(4, 'El PIN debe ser exactamente 4 dígitos.')
    .regex(/^\d{4}$/, 'El PIN debe ser numérico de 4 dígitos.'),
  birth_date: z
    .string()
    .min(1, 'La fecha de nacimiento es obligatoria.')
    .refine(
      (val) => {
        const date = new Date(val)
        return !isNaN(date.getTime()) && date <= new Date()
      },
      'La fecha de nacimiento no puede ser futura.'
    ),
  phone: z
    .string()
    .min(7, 'El teléfono debe tener al menos 7 dígitos.')
    .max(15, 'El teléfono no puede exceder 15 dígitos.')
    .regex(/^\d+$/, 'Solo dígitos numéricos.'),
  plan_id: z.string().min(1, 'Debe seleccionar un plan.'),
  observations: z
    .string()
    .max(500, 'Máximo 500 caracteres.')
    .optional()
    .or(z.literal('')),
})

type AffiliateFormValues = z.infer<typeof affiliateFormSchema>

interface ActivePlan {
  id: string
  name: string
}

/**
 * Affiliate registration form with Zod validation.
 * Fetches active plans for the plan selector dropdown.
 * On success, navigates to the new affiliate's profile page.
 *
 * Validates: Requirements 3.1, 4.1, 4.2, 4.3, 7.1
 */
export function AffiliateForm() {
  const router = useRouter()
  const { registerAffiliate } = useAffiliates()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activePlans, setActivePlans] = useState<ActivePlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)

  const form = useForm<AffiliateFormValues>({
    resolver: zodResolver(affiliateFormSchema) as any,
    defaultValues: {
      document_id: '',
      full_name: '',
      pin: '',
      birth_date: '',
      phone: '',
      plan_id: '',
      observations: '',
    },
  })

  // Fetch active plans on mount
  useEffect(() => {
    async function fetchActivePlans() {
      try {
        const res = await fetch('/api/plans?pageSize=100')
        const json = await res.json()
        if (res.ok && json.success) {
          const plans = json.data.data || json.data
          const active = (Array.isArray(plans) ? plans : []).filter(
            (p: any) => p.status === 'active'
          )
          setActivePlans(active.map((p: any) => ({ id: p.id, name: p.name })))
        }
      } catch {
        // Failed to load plans — user will see empty select
      } finally {
        setLoadingPlans(false)
      }
    }

    fetchActivePlans()
  }, [])

  async function handleSubmit(values: AffiliateFormValues) {
    setIsSubmitting(true)

    const result = await registerAffiliate({
      document_id: values.document_id,
      full_name: values.full_name,
      pin: values.pin,
      birth_date: values.birth_date,
      phone: values.phone,
      plan_id: values.plan_id,
      observations: values.observations || null,
    })

    setIsSubmitting(false)

    if (result) {
      router.push(`/affiliates/${result.id}`)
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Registrar Afiliado</CardTitle>
        <CardDescription>
          Completa los datos para registrar un nuevo afiliado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Document ID */}
            <FormField
              control={form.control}
              name="document_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Documento de identidad</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: 1234567890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Full Name */}
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Juan Pérez López" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* PIN */}
            <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PIN (4 dígitos)</FormLabel>
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

            {/* Birth Date */}
            <FormField
              control={form.control}
              name="birth_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de nacimiento</FormLabel>
                  <FormControl>
                    <Input type="date" max={new Date().toISOString().split('T')[0]} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Celular</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: 3001234567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Plan selector */}
            <FormField
              control={form.control}
              name="plan_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={loadingPlans}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingPlans
                              ? 'Cargando planes...'
                              : 'Seleccionar plan'
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activePlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                      {!loadingPlans && activePlans.length === 0 && (
                        <SelectItem value="" disabled>
                          No hay planes activos
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Observations */}
            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notas adicionales sobre el afiliado..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/affiliates')}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Registrando...' : 'Registrar'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
