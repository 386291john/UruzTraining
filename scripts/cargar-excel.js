/**
 * Script para carga masiva de afiliados desde un archivo Excel.
 * 
 * USO:
 *   node scripts/cargar-excel.js ruta/al/archivo.xlsx
 * 
 * FORMATO DEL EXCEL (columnas requeridas):
 * | documento | nombre | pin | fecha_nacimiento | celular | plan | dias_restantes | fecha_vencimiento | observaciones |
 * |-----------|--------|-----|------------------|---------|------|---------------|-------------------|---------------|
 * | 1032386291| Juan P | 1234| 1990-01-15      | 3001234 | 8 Dias| 5            | 2026-08-20       |               |
 * 
 * NOTAS:
 * - La columna "plan" debe coincidir EXACTAMENTE con el nombre del plan en el sistema
 * - "dias_restantes" = cuántos días le quedan por usar
 * - "fecha_vencimiento" = hasta cuándo tiene vigente el plan (YYYY-MM-DD)
 * - "pin" = 4 dígitos. Si no se proporciona, se asigna "1234" por defecto
 * - "fecha_nacimiento" formato YYYY-MM-DD
 * - "observaciones" es opcional
 */

const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Variables NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY requeridas en .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  const filePath = process.argv[2]

  if (!filePath) {
    console.error('❌ Uso: node scripts/cargar-excel.js <ruta-al-archivo.xlsx>')
    console.log('')
    console.log('Formato del Excel (columnas):')
    console.log('  documento | nombre | pin | fecha_nacimiento | celular | plan | dias_restantes | fecha_vencimiento | observaciones')
    process.exit(1)
  }

  console.log(`📂 Leyendo archivo: ${filePath}`)

  // Leer Excel
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet)

  console.log(`📊 Filas encontradas: ${rows.length}`)

  if (rows.length === 0) {
    console.error('❌ El archivo está vacío')
    process.exit(1)
  }

  // Obtener instructor
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, role')
    .limit(1)

  if (!profiles || profiles.length === 0) {
    console.error('❌ No se encontraron instructores en el sistema')
    process.exit(1)
  }

  const instructorId = profiles[0].id
  console.log(`👤 Instructor asignado: ${instructorId}`)

  // Obtener planes disponibles
  const { data: plans } = await supabase
    .from('plans')
    .select('id, name, allowed_days, vigency_weeks')
    .eq('status', 'active')

  if (!plans || plans.length === 0) {
    console.error('❌ No hay planes activos en el sistema')
    process.exit(1)
  }

  const planMap = new Map(plans.map(p => [p.name.toLowerCase().trim(), p]))
  console.log(`📋 Planes disponibles: ${plans.map(p => p.name).join(', ')}`)
  console.log('')

  // Procesar filas
  let exitosos = 0
  let errores = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // +2 por header + index 0

    try {
      // Leer columnas (flexible con nombres)
      const documento = String(row.documento || row.document_id || row.cedula || '').trim()
      const nombre = String(row.nombre || row.full_name || row.name || '').trim()
      const pin = String(row.pin || '1234').trim().padStart(4, '0')
      const fechaNac = String(row.fecha_nacimiento || row.birth_date || row.nacimiento || '2000-01-01').trim()
      const celular = String(row.celular || row.phone || row.telefono || '').trim()
      const planNombre = String(row.plan || row.plan_nombre || '').trim()
      const diasRestantes = parseInt(row.dias_restantes || row.remaining_days || '0', 10)
      const fechaVencimiento = String(row.fecha_vencimiento || row.expiration_date || '').trim()
      const observaciones = String(row.observaciones || row.observations || '').trim() || null

      // Validaciones básicas
      if (!documento || documento.length < 5) {
        console.error(`  ❌ Fila ${rowNum}: Documento inválido "${documento}"`)
        errores++
        continue
      }
      if (!nombre || nombre.length < 3) {
        console.error(`  ❌ Fila ${rowNum}: Nombre inválido "${nombre}"`)
        errores++
        continue
      }
      if (!celular || celular.length < 7) {
        console.error(`  ❌ Fila ${rowNum}: Celular inválido "${celular}"`)
        errores++
        continue
      }
      if (!fechaVencimiento) {
        console.error(`  ❌ Fila ${rowNum}: Fecha de vencimiento requerida`)
        errores++
        continue
      }

      // Buscar plan
      const plan = planMap.get(planNombre.toLowerCase())
      if (!plan) {
        console.error(`  ❌ Fila ${rowNum}: Plan "${planNombre}" no encontrado. Disponibles: ${plans.map(p => p.name).join(', ')}`)
        errores++
        continue
      }

      // Verificar duplicado
      const { data: existing } = await supabase
        .from('affiliates')
        .select('id')
        .eq('document_id', documento)
        .single()

      if (existing) {
        console.warn(`  ⚠️ Fila ${rowNum}: Documento ${documento} ya existe. Omitido.`)
        errores++
        continue
      }

      // Insertar afiliado
      const { data: affiliate, error: affError } = await supabase
        .from('affiliates')
        .insert({
          document_id: documento,
          full_name: nombre,
          pin: pin,
          birth_date: fechaNac,
          phone: celular,
          instructor_id: instructorId,
          observations: observaciones,
        })
        .select('id')
        .single()

      if (affError) {
        console.error(`  ❌ Fila ${rowNum}: Error al crear afiliado: ${affError.message}`)
        errores++
        continue
      }

      // Insertar membresía
      const today = new Date().toISOString().split('T')[0]
      const { error: memError } = await supabase
        .from('memberships')
        .insert({
          affiliate_id: affiliate.id,
          plan_id: plan.id,
          usage_start_date: today,
          weeks_count_start_date: today,
          expiration_date: fechaVencimiento,
          remaining_days: diasRestantes > 0 ? diasRestantes : (plan.allowed_days || null),
          status: 'active',
        })

      if (memError) {
        console.error(`  ❌ Fila ${rowNum}: Error al crear membresía: ${memError.message}`)
        errores++
        continue
      }

      console.log(`  ✅ Fila ${rowNum}: ${nombre} (${documento}) — Plan: ${planNombre}, Días restantes: ${diasRestantes}`)
      exitosos++

    } catch (err) {
      console.error(`  ❌ Fila ${rowNum}: Error inesperado: ${err.message}`)
      errores++
    }
  }

  console.log('')
  console.log('═══════════════════════════════════════')
  console.log(`✅ Exitosos: ${exitosos}`)
  console.log(`❌ Errores: ${errores}`)
  console.log(`📊 Total procesados: ${rows.length}`)
  console.log('═══════════════════════════════════════')
}

main().catch(err => {
  console.error('Error fatal:', err.message)
  process.exit(1)
})
