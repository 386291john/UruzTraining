"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"

const pageTitles: Record<string, string> = {
  "/": "Tablero",
  "/plans": "Planes",
  "/affiliates": "Afiliados",
  "/entry": "Ingreso",
  "/reports": "Informes",
  "/settings": "Configuración",
}

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  const match = Object.entries(pageTitles).find(
    ([path]) => path !== "/" && pathname.startsWith(path)
  )
  return match ? match[1] : "UruzTraining"
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userName, setUserName] = useState("Usuario")
  const [userRole, setUserRole] = useState("admin")
  const pathname = usePathname()
  const router = useRouter()
  const pageTitle = getPageTitle(pathname)

  // Fetch user session
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session')
        const json = await res.json()
        if (json.success && json.data?.user) {
          setUserName(json.data.user.fullName || json.data.user.email || 'Usuario')
          setUserRole(json.data.user.role || 'admin')

          // Redirect gimnasio role to /entry if on any other page
          if (json.data.user.role === 'gimnasio' && pathname !== '/entry') {
            router.push('/entry')
          }
        }
      } catch {
        // silent
      }
    }
    fetchSession()
  }, [])

  // Logout function
  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // silent
    }
    router.push('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar - fixed */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border md:block">
        <Sidebar userRole={userRole} />
      </aside>

      {/* Mobile sidebar - Sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <Sidebar
            userRole={userRole}
            onNavigate={() => setSidebarOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={pageTitle}
          userName={userName}
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={handleLogout}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
