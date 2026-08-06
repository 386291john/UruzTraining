"use client"

import { Menu, Moon, Sun, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "@/hooks/use-theme"

interface HeaderProps {
  title: string
  userName?: string
  onMenuClick: () => void
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function Header({ title, userName = "Usuario", onMenuClick }: HeaderProps) {
  const { theme, toggleTheme, mounted } = useTheme()

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
        aria-label="Abrir menú de navegación"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Page title */}
      <h1 className="text-lg font-semibold md:text-xl">{title}</h1>

      {/* Right side actions */}
      <div className="ml-auto flex items-center gap-2">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}
          className="transition-colors duration-200"
        >
          {mounted && theme === "light" ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </Button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="flex flex-col px-2 py-1.5">
              <p className="text-sm font-medium">{userName}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
