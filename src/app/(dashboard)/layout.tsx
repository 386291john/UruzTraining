"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
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

  // Check prefix matches for nested routes
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
  const pathname = usePathname()
  const pageTitle = getPageTitle(pathname)

  // TODO: Replace with actual user data from auth context
  const userName = "Usuario"
  const userRole = "admin"

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
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
