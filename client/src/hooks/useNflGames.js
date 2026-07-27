import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetchJson } from '../utils/api'
import { useInterval } from './useInterval'

function formatOptionLabel(g) {
    const name = g?.shortName || g?.name || g?.id
    const status = g?.status?.detail || g?.status?.state
    return status ? `${name} — ${status}` : String(name)
}

export function useNflGames({ pollMs = 30000 } = {}) {
    const [live, setLive] = useState([])
    const [upcoming, setUpcoming] = useState([])
    const [previous, setPrevious] = useState([])
    const [lastError, setLastError] = useState(null)
    const [meta, setMeta] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchOnce = useCallback(async () => {
        try {
            const data = await apiFetchJson('/api/nfl/games?upcomingLimit=48&previousLimit=80')
            setLive((data?.live || []).map((g) => ({ ...g, label: formatOptionLabel(g) })))
            setUpcoming(
                (data?.upcoming || []).map((g) => ({ ...g, label: formatOptionLabel(g) }))
            )
            setPrevious(
                (data?.previous || []).map((g) => ({ ...g, label: formatOptionLabel(g) }))
            )
            setMeta(data?.meta || null)
            setLastError(null)
        } catch (err) {
            setLastError(String(err?.message || err))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        const timer = window.setTimeout(fetchOnce, 0)
        return () => window.clearTimeout(timer)
    }, [fetchOnce])

    useInterval(fetchOnce, pollMs)

    const byId = useMemo(() => {
        const m = new Map()
        for (const g of [...live, ...upcoming, ...previous]) {
            if (g?.id) m.set(g.id, g)
        }
        return m
    }, [live, upcoming, previous])

    return {
        live,
        upcoming,
        previous,
        byId,
        lastError,
        loading,
        meta,
        refresh: fetchOnce,
    }
}
