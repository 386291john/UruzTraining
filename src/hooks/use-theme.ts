"use client"

import { useCallback, useEffect, useState } from "react"

type Theme = "light" | "dark"

const STORAGE_KEY = "uruz-theme"

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark"

  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === "light" || stored === "dark") return stored

  return "dark"
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setTheme(getInitialTheme())
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme, mounted])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"))
  }, [])

  return { theme, toggleTheme, mounted }
}
