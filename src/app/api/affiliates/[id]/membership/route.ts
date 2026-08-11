/**
 * API Route Handler for /api/affiliates/[id]/membership
 * PUT: Update membership expiration date (admin/instructor only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/utils/api-helpers'
import { handleRouteError } from '@/lib/utils/error-handler'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

interface RouteContext {
  params: Promise<{ id: string }>
}

const updateSchema = z.object({
  expiration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
})

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const { id } = await context.params
    const body = await request.json()

    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Find active membership for this affiliate
    const { data: membership, error: findError } = await supabase
      .from('memberships')
      .select('id')
      .eq('affiliate_id', id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (findError || !membership) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No se encontró membresía activa.' } },
        { status: 404 }
      )
    }

    // Update expiration date
    const { error: updateError } = await supabase
      .from('memberships')
      .update({ expiration_date: parsed.data.expiration_date })
      .eq('id', membership.id)

    if (updateError) {
      throw new Error(`Error al actualizar fecha: ${updateError.message}`)
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    return handleRouteError(error, {
      operation: 'PUT /api/affiliates/[id]/membership',
      method: 'PUT',
      path: '/api/affiliates/[id]/membership',
    })
  }
}
