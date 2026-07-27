import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetchJson } from '../utils/api'
import { useInterval } from './useInterval'

const FALLBACK_EVENT_ID = '401772988'

function getEventId() {
    const envId = import.meta.env.VITE_EVENT_ID
    return String(envId || '').trim() || FALLBACK_EVENT_ID
}

function getStoredEventId() {
    try {
        const v = localStorage.getItem('playByPlay.eventId')
        return v ? String(v) : ''
    } catch {
        return ''
    }
}

function setStoredEventId(eventId) {
    try {
        if (!eventId) localStorage.removeItem('playByPlay.eventId')
        else localStorage.setItem('playByPlay.eventId', String(eventId))
    } catch {
        // ignore
    }
}

export function useGamePlays({ eventId: eventIdProp, pollMs = 5000, limit = 60 } = {}) {
    const defaultEventId = useMemo(() => {
        return getStoredEventId() || getEventId()
    }, [])

    const [eventId, setEventId] = useState(eventIdProp || defaultEventId)
    const [mode, setMode] = useState('live') // 'live' | 'mock'
    const [status, setStatus] = useState({ watching: false, lastError: null })
    const [plays, setPlays] = useState([])
    const [currentPlayId, setCurrentPlayId] = useState(null)

    // Analysis playback: a cursor over the (chronological) play list
    const [analysisEnabled, setAnalysisEnabled] = useState(false)
    const [analysisRunning, setAnalysisRunning] = useState(false)
    const [analysisIndex, setAnalysisIndex] = useState(0)
    const [pendingStartQuarter, setPendingStartQuarter] = useState(null)

    const explanationByPlayIdRef = useRef(new Map())
    const inFlightExplainRef = useRef(new Set())

    // Allow external control of eventId (dropdown)
    useEffect(() => {
        if (eventIdProp && eventIdProp !== eventId) {
            setEventId(eventIdProp)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventIdProp])

    useEffect(() => {
        setStoredEventId(eventId)
    }, [eventId])

    useEffect(() => {
        // When switching games, reset feed + caches so the UI doesn't mix games.
        setPlays([])
        setCurrentPlayId(null)
        setAnalysisEnabled(false)
        setAnalysisRunning(false)
        setAnalysisIndex(0)
        explanationByPlayIdRef.current = new Map()
        inFlightExplainRef.current = new Set()
        setMode('live')
    }, [eventId])

    const effectiveLimit = Math.max(limit, analysisEnabled ? 600 : limit)

    const upsertPlays = useCallback((incoming) => {
        setPlays((prev) => {
            const byId = new Map()

            for (const p of prev) {
                if (p?.id) byId.set(p.id, p)
            }
            for (const p of incoming) {
                if (p?.id) byId.set(p.id, p)
            }

            const merged = Array.from(byId.values())
            merged.sort((a, b) => {
                const ai = Number(a?.id)
                const bi = Number(b?.id)
                if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi
                return String(a?.id || '').localeCompare(String(b?.id || ''))
            })

            // Keep only the newest N plays to avoid unbounded growth
            return merged.slice(-Math.max(20, effectiveLimit))
        })
    }, [effectiveLimit])

    const ensureWatching = useCallback(async () => {
        try {
            await apiFetchJson(`/api/games/${encodeURIComponent(eventId)}/watch`, {
                method: 'POST',
                body: {},
            })
            setStatus({ watching: true, lastError: null })
            setMode('live')
        } catch (err) {
            // If backend isn't running or ESPN event is invalid, fall back to mock
            console.warn('Live watch failed, falling back to mock:', err)
            setStatus({ watching: false, lastError: String(err?.message || err) })
            setMode('mock')
        }
    }, [eventId])

    const pollOnce = useCallback(async () => {
        if (mode === 'mock') {
            const data = await apiFetchJson('/api/mock/plays')
            const incoming = data?.plays || []
            // Simulate new plays arriving by advancing one at a time
            const next = incoming.find((p) => !plays.some((x) => x.id === p.id))
            if (next) {
                upsertPlays([next])
                if (!analysisEnabled) setCurrentPlayId(next.id)
            } else if (incoming.length > 0 && !currentPlayId) {
                upsertPlays([incoming[0]])
                if (!analysisEnabled) setCurrentPlayId(incoming[0].id)
            }
            return
        }

        try {
            const data = await apiFetchJson(
                `/api/games/${encodeURIComponent(eventId)}/plays?limit=${effectiveLimit}`
            )
            const incoming = data?.plays || []
            if (incoming.length > 0) {
                upsertPlays(incoming)
                if (!analysisEnabled) {
                    const latest = incoming[incoming.length - 1]
                    setCurrentPlayId(latest?.id || null)
                }
            }
            setStatus((s) => ({ ...s, lastError: null }))
        } catch (err) {
            setStatus((s) => ({ ...s, lastError: String(err?.message || err) }))
        }
    }, [mode, eventId, effectiveLimit, plays, currentPlayId, upsertPlays, analysisEnabled])

    useEffect(() => {
        ensureWatching()
    }, [ensureWatching])

    useEffect(() => {
        // initial fetch
        pollOnce()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode])

    useInterval(pollOnce, pollMs)

    useEffect(() => {
        // When analysis is turned on, quickly fetch a larger window so
        // quarter jumps / restart can find early-game plays.
        if (!analysisEnabled) return
        pollOnce()
    }, [analysisEnabled, pollOnce])

    // Keep the current play in sync with analysis cursor
    useEffect(() => {
        if (!analysisEnabled) return
        if (!plays.length) return
        const idx = Math.max(0, Math.min(analysisIndex, plays.length - 1))
        const p = plays[idx]
        if (p?.id) setCurrentPlayId(p.id)
    }, [analysisEnabled, analysisIndex, plays])

    // If user requested a quarter jump before we had that quarter loaded,
    // start once the data arrives.
    useEffect(() => {
        if (!analysisEnabled) return
        if (pendingStartQuarter == null) return
        if (!plays.length) return
        const idx = plays.findIndex((p) => Number(p?.quarter) === Number(pendingStartQuarter))
        if (idx < 0) return
        setAnalysisIndex(idx)
        setAnalysisRunning(true)
        setPendingStartQuarter(null)
    }, [analysisEnabled, pendingStartQuarter, plays])

    // Auto-advance analysis cursor while running
    useInterval(
        () => {
            if (!analysisEnabled || !analysisRunning) return
            setAnalysisIndex((idx) => {
                const next = idx + 1
                if (next >= plays.length) {
                    setAnalysisRunning(false)
                    return idx
                }
                return next
            })
        },
        analysisEnabled && analysisRunning ? 2200 : null
    )

    const restartAnalysis = useCallback(() => {
        setAnalysisEnabled(true)
        setPendingStartQuarter(1)
        setAnalysisRunning(false)
    }, [])

    const startAtQuarter = useCallback(
        (q) => {
            const quarter = Number(q)
            if (!Number.isFinite(quarter)) return
            const idx = plays.findIndex((p) => Number(p?.quarter) === quarter)
            setAnalysisEnabled(true)
            if (idx >= 0) {
                setPendingStartQuarter(null)
                setAnalysisIndex(idx)
                setAnalysisRunning(true)
            } else {
                setPendingStartQuarter(quarter)
                setAnalysisRunning(false)
            }
        },
        [plays]
    )

    const currentPlay = useMemo(() => {
        if (!currentPlayId) return null
        return plays.find((p) => p.id === currentPlayId) || null
    }, [plays, currentPlayId])

    const explanation = useMemo(() => {
        if (!currentPlay?.id) return null
        return (
            currentPlay.explanation ||
            explanationByPlayIdRef.current.get(currentPlay.id) ||
            null
        )
    }, [currentPlay])

    useEffect(() => {
        async function maybeExplain() {
            if (!currentPlay?.id) return
            if (currentPlay.explanation) return
            if (explanationByPlayIdRef.current.has(currentPlay.id)) return
            if (!currentPlay.text) return
            if (inFlightExplainRef.current.has(currentPlay.id)) return

            inFlightExplainRef.current.add(currentPlay.id)
            try {
                const data = await apiFetchJson('/api/explain-play', {
                    method: 'POST',
                    body: { text: currentPlay.text },
                })
                const exp = data?.explanation?.text || null
                if (exp) {
                    explanationByPlayIdRef.current.set(currentPlay.id, exp)
                    // force rerender without changing play list shape
                    setCurrentPlayId((id) => id)
                }
            } catch (err) {
                console.warn('Explain failed:', err)
            } finally {
                inFlightExplainRef.current.delete(currentPlay.id)
            }
        }

        maybeExplain()
    }, [currentPlay])

    return {
        eventId,
        setEventId,
        mode,
        status,
        plays,
        currentPlay,
        explanation,
        analysis: {
            enabled: analysisEnabled,
            running: analysisRunning,
        },
        restartAnalysis,
        startAtQuarter,
    }
}
