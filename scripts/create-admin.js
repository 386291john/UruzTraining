/**
 * Script to create the initial admin user in Supabase Auth.
 * Run once: node scripts/create-admin.js
 * 
 * The on_auth_user_created trigger will automatically create the profile
 * with role='admin' based on the user_metadata.
 */
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://thcyjxnkcvpptdpbvqez.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('Error: Set SUPABASE_SERVICE_ROLE_KEY environment variable')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function createAdmin() {
  const email = process.argv[2]
  const password = process.argv[3]
  const fullName = process.argv[4] || 'Administrador'

  if (!email || !password) {
    console.error('Usage: node scripts/create-admin.js <email> <password> [fullName]')
    process.exit(1)
  }

  console.log(`Creating admin user: ${email}`)

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: 'admin'
    }
  })

  if (error) {
    console.error('Error creating user:', error.message)
    process.exit(1)
  }

  console.log('Admin user created successfully!')
  console.log('  ID:', data.user.id)
  console.log('  Email:', data.user.email)
  console.log('  Role: admin')
  console.log('  Name:', fullName)
  console.log('')
  console.log('The profile was auto-created by the database trigger.')
}

createAdmin()
