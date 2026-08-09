"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  DoorOpen,
  BarChart3,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

export interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
  /** If set, only these roles can see this item */
  allowedRoles?: string[]
}

const navItems: NavItem[] = [
  { label: "Tablero", href: "/", icon: LayoutDashboard, allowedRoles: ['admin', 'instructor'] },
  { label: "Planes", href: "/plans", icon: ClipboardList, allowedRoles: ['admin', 'instructor'] },
  { label: "Afiliados", href: "/affiliates", icon: Users, allowedRoles: ['admin', 'instructor'] },
  { label: "Ingreso", href: "/entry", icon: DoorOpen },
  { label: "Informes", href: "/reports", icon: BarChart3, allowedRoles: ['admin', 'instructor'] },
  { label: "Configuración", href: "/settings", icon: Settings, adminOnly: true },
]

interface SidebarProps {
  userRole?: string
  onNavigate?: () => void
}

export function Sidebar({ userRole = "staff", onNavigate }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  const visibleItems = navItems.filter((item) => {
    if (item.adminOnly && userRole !== 'admin') return false
    if (item.allowedRoles && !item.allowedRoles.includes(userRole)) return false
    return true
  })

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center gap-2 px-4">
        <Image
          src="/logo.png"
          alt="UruzTraining"
          width={36}
          height={36}
          className="h-9 w-9 object-contain"
        />
        <span className="text-lg font-bold tracking-tight">UruzTraining</span>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      <Separator className="bg-sidebar-border" />

      {/* User role badge */}
      <div className="flex items-center gap-2 px-4 py-3">
        <Badge variant="secondary" className="capitalize">
          {userRole}
        </Badge>
      </div>
    </div>
  )
}
