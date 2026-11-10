import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { AppUser, UserRole } from '../../../core/domain/entities'

interface AuthContextValue {
  user: AppUser | null
  login: (email: string, password: string, role: UserRole) => boolean
  logout: () => void
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const STORAGE_KEY = 'vision-ai-demo-session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as AppUser | null } catch { return null }
  })
  const value = useMemo<AuthContextValue>(() => ({
    user,
    login: (email, password, role) => {
      if (email.trim().toLowerCase() !== 'demo@visionai.com' || password !== 'visionai2026') return false
      const nextUser: AppUser = { id: `USR-${Date.now()}`, name: role === 'Administrador' ? 'Alex Morgan' : role === 'Supervisor' ? 'Sam Taylor' : role === 'Auditor' ? 'Jordan Lee' : 'Chris Rivera', email, role }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser)); setUser(nextUser); return true
    },
    logout: () => { localStorage.removeItem(STORAGE_KEY); setUser(null) },
  }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider')
  return context
}
