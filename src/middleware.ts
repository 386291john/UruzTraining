import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js middleware for authentication.
 * - Verifies session on every request to protected routes.
 * - Redirects unauthenticated users to /login.
 * - Redirects authenticated users away from /login to /.
 * - Refreshes session tokens via cookie handling on each request.
 *
 * Validates: Requirements 1.5, 1.6
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // IMPORTANT: Do NOT use getSession() here.
  // getUser() sends a request to the Supabase Auth server every time to
  // revalidate the Auth token, while getSession() does not.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // If user is authenticated and trying to access /login, redirect to dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Define public routes that don't require authentication
  const isPublicRoute =
    pathname === '/login' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')

  // If not a public route and no valid user, redirect to login
  if (!isPublicRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'

    // Check if the user had a session cookie that is now expired
    const hasExpiredSession = request.cookies.getAll().some(
      (cookie) => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
    )

    if (hasExpiredSession) {
      url.searchParams.set('message', 'session_expired')
    }

    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Public assets (images, svgs, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
