import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi } from '../lib/authApi'
import type { Gathering, OrganizerAccount } from '../types'

type AuthStore = {
  user: OrganizerAccount | null
  myGatherings: Gathering[]
  authConfigured: boolean
  loading: boolean
  refreshAuth: () => Promise<void>
  logout: () => Promise<void>
  ownsGathering: (gatheringId: string) => boolean
}

const OrganizerAuthContext = createContext<AuthStore | null>(null)

export function OrganizerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<OrganizerAccount | null>(null)
  const [myGatherings, setMyGatherings] = useState<Gathering[]>([])
  const [authConfigured, setAuthConfigured] = useState(false)
  const [loading, setLoading] = useState(true)

  const refreshAuth = useCallback(async () => {
    setLoading(true)
    try {
      const status = await authApi.status()
      setAuthConfigured(status.configured)
      if (!status.configured) {
        setUser(null)
        setMyGatherings([])
        return
      }
      try {
        const me = await authApi.me()
        setUser(me.user)
        const list = await authApi.myGatherings()
        setMyGatherings(list)
      } catch {
        setUser(null)
        setMyGatherings([])
      }
    } catch {
      setAuthConfigured(false)
      setUser(null)
      setMyGatherings([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshAuth()
  }, [refreshAuth])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
    setMyGatherings([])
  }, [])

  const ownsGathering = useCallback(
    (gatheringId: string) => {
      if (!user) return false
      return myGatherings.some((g) => g.id === gatheringId)
    },
    [user, myGatherings],
  )

  const value = useMemo(
    () => ({
      user,
      myGatherings,
      authConfigured,
      loading,
      refreshAuth,
      logout,
      ownsGathering,
    }),
    [user, myGatherings, authConfigured, loading, refreshAuth, logout, ownsGathering],
  )

  return (
    <OrganizerAuthContext.Provider value={value}>{children}</OrganizerAuthContext.Provider>
  )
}

export function useOrganizerAuth() {
  const ctx = useContext(OrganizerAuthContext)
  if (!ctx) throw new Error('useOrganizerAuth must be used within OrganizerAuthProvider')
  return ctx
}
