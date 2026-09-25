import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../lib/api'
import {
  forgetGatheringId,
  loadKnownIds,
  rememberGatheringId,
  saveKnownIds,
} from '../lib/knownIds'
import {
  forgetOrganizerCode,
  loadOrganizerCode,
  saveOrganizerCode,
} from '../lib/organizerAccess'
import type {
  Attendee,
  CarteItem,
  Gathering,
  GatheringInput,
  MenuItem,
  MessageInput,
} from '../types'

type AddAttendeeInput = Omit<Attendee, 'id' | 'createdAt' | 'amountPaid'> & {
  amountPaid?: number
  guestKey?: string
}

type Store = {
  gatherings: Gathering[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  ensureGathering: (id: string) => Promise<Gathering | null>
  createGathering: (input: GatheringInput) => Promise<{
    gathering: Gathering
    organizerCode: string
  }>
  unlockWithCode: (code: string) => Promise<{
    gathering: Gathering
    organizerCode: string
  }>
  unlockEvent: (
    gatheringId: string,
    code: string,
  ) => Promise<{ gathering: Gathering; organizerCode: string }>
  updateOrganizerCode: (
    gatheringId: string,
    code: string,
  ) => Promise<{ gathering: Gathering; organizerCode: string }>
  hasOrganizerAccess: (gatheringId: string) => boolean
  updateGathering: (id: string, patch: Partial<Gathering>) => Promise<void>
  deleteGathering: (id: string) => Promise<void>
  addMenuItem: (gatheringId: string, item: Omit<MenuItem, 'id'>) => Promise<void>
  setMenuCard: (gatheringId: string, menuCardUrl: string) => Promise<void>
  setMenuCarte: (
    gatheringId: string,
    items: CarteItem[],
    approved: boolean,
  ) => Promise<void>
  removeMenuItem: (gatheringId: string, itemId: string) => Promise<void>
  addAttendee: (
    gatheringId: string,
    attendee: AddAttendeeInput,
    options?: { asGuest?: boolean },
  ) => Promise<{ attendeeId: string; updated: boolean; guestKey?: string }>
  updateAttendee: (
    gatheringId: string,
    attendeeId: string,
    patch: Partial<Attendee>,
  ) => Promise<void>
  removeAttendee: (gatheringId: string, attendeeId: string) => Promise<void>
  sendMessage: (gatheringId: string, message: MessageInput) => Promise<void>
  markMessageRead: (
    gatheringId: string,
    messageId: string,
    read?: boolean,
  ) => Promise<void>
  deleteMessage: (gatheringId: string, messageId: string) => Promise<void>
  getGathering: (id: string) => Gathering | undefined
}

const GatheringsContext = createContext<Store | null>(null)

function upsert(list: Gathering[], gathering: Gathering): Gathering[] {
  const idx = list.findIndex((g) => g.id === gathering.id)
  if (idx === -1) return [gathering, ...list]
  const next = [...list]
  next[idx] = gathering
  return next
}

export function GatheringsProvider({ children }: { children: ReactNode }) {
  const [gatherings, setGatherings] = useState<Gathering[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accessTick, setAccessTick] = useState(0)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const ids = loadKnownIds()
      const list = await api.listGatherings(ids)
      const foundIds = new Set(list.map((g) => g.id))
      saveKnownIds(ids.filter((id) => foundIds.has(id)))
      // Re-fetch with organizer codes so manage views keep full guest/inbox data
      const hydrated = await Promise.all(
        list.map(async (g) => {
          const code = loadOrganizerCode(g.id)
          if (!code) return g
          try {
            return await api.getGathering(g.id, code)
          } catch {
            return g
          }
        }),
      )
      setGatherings(hydrated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gatherings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const ensureGathering = useCallback(async (id: string) => {
    try {
      const gathering = await api.getGathering(id)
      rememberGatheringId(id)
      setGatherings((prev) => upsert(prev, gathering))
      setError(null)
      return gathering
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gathering not found')
      return null
    }
  }, [])

  const createGathering = useCallback(async (input: GatheringInput) => {
    const result = await api.createGathering(input)
    rememberGatheringId(result.gathering.id)
    saveOrganizerCode(result.gathering.id, result.organizerCode)
    setAccessTick((n) => n + 1)
    setGatherings((prev) => [result.gathering, ...prev])
    return result
  }, [])

  const unlockWithCode = useCallback(async (code: string) => {
    const result = await api.accessByCode(code)
    rememberGatheringId(result.gathering.id)
    saveOrganizerCode(result.gathering.id, result.organizerCode)
    setAccessTick((n) => n + 1)
    setGatherings((prev) => upsert(prev, result.gathering))
    return result
  }, [])

  const unlockEvent = useCallback(async (gatheringId: string, code: string) => {
    const result = await api.unlockGathering(gatheringId, code)
    rememberGatheringId(result.gathering.id)
    saveOrganizerCode(result.gathering.id, result.organizerCode)
    setAccessTick((n) => n + 1)
    setGatherings((prev) => upsert(prev, result.gathering))
    return result
  }, [])

  const updateOrganizerCode = useCallback(
    async (gatheringId: string, code: string) => {
      const result = await api.updateOrganizerCode(gatheringId, code)
      saveOrganizerCode(result.gathering.id, result.organizerCode)
      setAccessTick((n) => n + 1)
      setGatherings((prev) => upsert(prev, result.gathering))
      return result
    },
    [],
  )

  const hasOrganizerAccess = useCallback(
    (gatheringId: string) => {
      void accessTick
      return Boolean(loadOrganizerCode(gatheringId))
    },
    [accessTick],
  )

  const updateGathering = useCallback(async (id: string, patch: Partial<Gathering>) => {
    const current = gatherings.find((g) => g.id === id)
    if (!current) throw new Error('Gathering not found')
    const next = await api.updateGathering({ ...current, ...patch, id })
    setGatherings((prev) => upsert(prev, next))
  }, [gatherings])

  const deleteGathering = useCallback(async (id: string) => {
    await api.deleteGathering(id)
    forgetGatheringId(id)
    forgetOrganizerCode(id)
    setAccessTick((n) => n + 1)
    setGatherings((prev) => prev.filter((g) => g.id !== id))
  }, [])

  const addMenuItem = useCallback(
    async (gatheringId: string, item: Omit<MenuItem, 'id'>) => {
      const next = await api.addMenuItem(gatheringId, item)
      setGatherings((prev) => upsert(prev, next))
    },
    [],
  )

  const setMenuCard = useCallback(async (gatheringId: string, menuCardUrl: string) => {
    const next = await api.setMenuCard(gatheringId, menuCardUrl)
    setGatherings((prev) => upsert(prev, next))
  }, [])

  const setMenuCarte = useCallback(
    async (gatheringId: string, items: CarteItem[], approved: boolean) => {
      const next = await api.setMenuCarte(gatheringId, items, approved)
      setGatherings((prev) => upsert(prev, next))
    },
    [],
  )

  const removeMenuItem = useCallback(async (gatheringId: string, itemId: string) => {
    const next = await api.removeMenuItem(gatheringId, itemId)
    setGatherings((prev) => upsert(prev, next))
  }, [])

  const addAttendee = useCallback(
    async (
      gatheringId: string,
      attendee: AddAttendeeInput,
      options?: { asGuest?: boolean },
    ) => {
      const result = await api.addAttendee(gatheringId, attendee, options)
      setGatherings((prev) => upsert(prev, result.gathering))
      return {
        attendeeId: result.attendeeId,
        updated: result.updated,
        guestKey: result.guestKey,
      }
    },
    [],
  )

  const updateAttendee = useCallback(
    async (gatheringId: string, attendeeId: string, patch: Partial<Attendee>) => {
      const next = await api.updateAttendee(gatheringId, attendeeId, patch)
      setGatherings((prev) => upsert(prev, next))
    },
    [],
  )

  const removeAttendee = useCallback(async (gatheringId: string, attendeeId: string) => {
    const next = await api.removeAttendee(gatheringId, attendeeId)
    setGatherings((prev) => upsert(prev, next))
  }, [])

  const sendMessage = useCallback(async (gatheringId: string, message: MessageInput) => {
    await api.sendMessage(gatheringId, message)
  }, [])

  const markMessageRead = useCallback(
    async (gatheringId: string, messageId: string, read = true) => {
      const next = await api.updateMessage(gatheringId, messageId, { read })
      setGatherings((prev) => upsert(prev, next))
    },
    [],
  )

  const deleteMessage = useCallback(async (gatheringId: string, messageId: string) => {
    const next = await api.deleteMessage(gatheringId, messageId)
    setGatherings((prev) => upsert(prev, next))
  }, [])

  const getGathering = useCallback(
    (id: string) => gatherings.find((g) => g.id === id),
    [gatherings],
  )

  const value = useMemo(
    () => ({
      gatherings,
      loading,
      error,
      refresh,
      ensureGathering,
      createGathering,
      unlockWithCode,
      unlockEvent,
      updateOrganizerCode,
      hasOrganizerAccess,
      updateGathering,
      deleteGathering,
      addMenuItem,
      setMenuCard,
      setMenuCarte,
      removeMenuItem,
      addAttendee,
      updateAttendee,
      removeAttendee,
      sendMessage,
      markMessageRead,
      deleteMessage,
      getGathering,
    }),
    [
      gatherings,
      loading,
      error,
      refresh,
      ensureGathering,
      createGathering,
      unlockWithCode,
      unlockEvent,
      updateOrganizerCode,
      hasOrganizerAccess,
      updateGathering,
      deleteGathering,
      addMenuItem,
      setMenuCard,
      setMenuCarte,
      removeMenuItem,
      addAttendee,
      updateAttendee,
      removeAttendee,
      sendMessage,
      markMessageRead,
      deleteMessage,
      getGathering,
    ],
  )

  return (
    <GatheringsContext.Provider value={value}>{children}</GatheringsContext.Provider>
  )
}

export function useGatherings() {
  const ctx = useContext(GatheringsContext)
  if (!ctx) throw new Error('useGatherings must be used within GatheringsProvider')
  return ctx
}
