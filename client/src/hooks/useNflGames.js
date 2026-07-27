import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetchJson } from '../utils/api'
import { useInterval } from './useInterval'

function formatOptionLabel(g) {
    const name = g?.shortName || g?.name || g?.id
    const status = g?.status?.detail || g?.status?.state
    return status ? `${name} — ${status}` : String(name)
}

export function useNflGames({ pollMs = 30000, daysBack = 7 } = {}) {
    const [live, setLive] = useState([])
    const [previous, setPrevious] = useState([])
    const [lastError, setLastError] = useState(null)

    const fetchOnce = useCallback(async () => {
        try {
            const data = await apiFetchJson(
                `/api/nfl/games?daysBack=${daysBack}&previousSeason=1`
            )
            setLive((data?.live || []).map((g) => ({ ...g, label: formatOptionLabel(g) })))
            setPrevious(
                (data?.previous || []).map((g) => ({ ...g, label: formatOptionLabel(g) }))
            )
            setLastError(null)
        } catch (err) {
            setLastError(String(err?.message || err))
            setLive([])
            setPrevious([])
        }
    }, [daysBack])

    useEffect(() => {
        fetchOnce()
    }, [fetchOnce])

    useInterval(fetchOnce, pollMs)

    const byId = useMemo(() => {
        const m = new Map()
        for (const g of [...live, ...previous]) {
            if (g?.id) m.set(g.id, g)
        }
        return m
    }, [live, previous])

    return { live, previous, byId, lastError, refresh: fetchOnce }
}
