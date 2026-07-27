import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetchJson } from '../utils/api'
import { useInterval } from './useInterval'

function getEventId() {
    const envId = import.meta.env.VITE_EVENT_ID
    return String(envId || '').trim()
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

function getSessionId() {
    try {
        const stored = localStorage.getItem('playByPlay.sessionId')
        if (stored) return stored
        const value = crypto.randomUUID()
        localStorage.setItem('playByPlay.sessionId', value)
        return value
    } catch {
        return ''
    }
}

function toAgentPlay(play) {
    if (!play) return null
    return {
        id: play.id,
        text: play.text,
        quarter: play.quarter,
        clock: play.clock,
        down: play.down,
        distance: play.distance,
        yardLine: play.yardLine,
        possessionText: play.possessionText,
        team: play.team,
        typeText: play.typeText,
        parsed: play.parsed,
    }
}

export function useGamePlays({
    eventId: eventIdProp,
    pollMs = 5000,
    limit = 60,
    audience = 'rookie',
} = {}) {
    const defaultEventId = useMemo(() => {
        return getStoredEventId() || getEventId()
    }, [])

    const [eventId, setEventIdState] = useState(eventIdProp || defaultEventId)
    const [mode, setMode] = useState('live') // 'live' | 'mock'
    const [status, setStatus] = useState({ watching: false, lastError: null })
    const [plays, setPlays] = useState([])
    const [currentPlayId, setCurrentPlayId] = useState(null)
    const [explanationVersion, setExplanationVersion] = useState(0)
    const sessionId = useMemo(getSessionId, [])

    // Manual playback: keep ingesting live plays while the viewer reviews at their pace.
    const [analysisEnabled, setAnalysisEnabled] = useState(false)
    const [analysisIndex, setAnalysisIndex] = useState(0)
    const [pendingStartQuarter, setPendingStartQuarter] = useState(null)

    const explanationByPlayIdRef = useRef(new Map())
    const inFlightExplainRef = useRef(new Set())

    const setEventId = useCallback((nextEventId) => {
        const next = String(nextEventId || '').trim()
        setEventIdState((previous) => {
            if (previous && previous !== next) {
                apiFetchJson(`/api/games/${encodeURIComponent(previous)}/watch`, {
                    method: 'DELETE',
                }).catch(() => {})
            }
            return next
        })
    }, [])

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
        setAnalysisIndex(0)
        setStatus({ watching: false, lastError: null, game: null })
        explanationByPlayIdRef.current = new Map()
        inFlightExplainRef.current = new Set()
        setExplanationVersion((version) => version + 1)
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
        if (!eventId) {
            setStatus({ watching: false, lastError: null, game: null })
            return
        }
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
        if (!eventId) return
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
            setStatus((currentStatus) => ({
                ...currentStatus,
                watching: true,
                lastError: data?.state?.lastError || null,
                game: data?.state?.game || currentStatus.game || null,
                lastPollAt: data?.state?.lastPollAt || null,
                nextPollAt: data?.state?.nextPollAt || null,
            }))
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
        setPendingStartQuarter(null)
    }, [analysisEnabled, pendingStartQuarter, plays])

    const restartAnalysis = useCallback(() => {
        setAnalysisEnabled(true)
        setPendingStartQuarter(1)
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
            } else {
                setPendingStartQuarter(quarter)
            }
        },
        [plays]
    )

    const selectPlay = useCallback(
        (playId) => {
            const index = plays.findIndex((play) => play.id === playId)
            if (index < 0) return
            setAnalysisEnabled(true)
            setPendingStartQuarter(null)
            setAnalysisIndex(index)
            setCurrentPlayId(playId)
        },
        [plays]
    )

    const pausePlayback = useCallback(() => {
        if (!plays.length) return
        const currentIndex = plays.findIndex((play) => play.id === currentPlayId)
        setPendingStartQuarter(null)
        setAnalysisIndex(currentIndex >= 0 ? currentIndex : plays.length - 1)
        setAnalysisEnabled(true)
    }, [currentPlayId, plays])

    const stepPrevious = useCallback(() => {
        if (!plays.length) return
        const currentIndex = plays.findIndex((play) => play.id === currentPlayId)
        const startingIndex = analysisEnabled
            ? analysisIndex
            : currentIndex >= 0
              ? currentIndex
              : plays.length - 1
        setPendingStartQuarter(null)
        setAnalysisIndex(Math.max(0, startingIndex - 1))
        setAnalysisEnabled(true)
    }, [analysisEnabled, analysisIndex, currentPlayId, plays])

    const stepNext = useCallback(() => {
        if (!plays.length) return
        const currentIndex = plays.findIndex((play) => play.id === currentPlayId)
        const startingIndex = analysisEnabled
            ? analysisIndex
            : currentIndex >= 0
              ? currentIndex
              : plays.length - 1
        setPendingStartQuarter(null)
        setAnalysisIndex(Math.min(plays.length - 1, startingIndex + 1))
        setAnalysisEnabled(true)
    }, [analysisEnabled, analysisIndex, currentPlayId, plays])

    const resumeLive = useCallback(() => {
        setPendingStartQuarter(null)
        setAnalysisEnabled(false)
        const latest = plays[plays.length - 1]
        setAnalysisIndex(Math.max(0, plays.length - 1))
        setCurrentPlayId(latest?.id || null)
    }, [plays])

    const currentPlay = useMemo(() => {
        if (!currentPlayId) return null
        return plays.find((p) => p.id === currentPlayId) || null
    }, [plays, currentPlayId])

    let explanation = null
    if (currentPlay?.id) {
        const key = `${currentPlay.id}:${audience}`
        explanation = (
            (audience === 'rookie' ? currentPlay.explanation : null) ||
            explanationByPlayIdRef.current.get(key) ||
            null
        )
    }
    // This state is intentionally read so a ref-cache write refreshes the value above.
    void explanationVersion

    useEffect(() => {
        async function maybeExplain() {
            if (!currentPlay?.id) return
            if (audience === 'rookie' && currentPlay.explanation) return
            const key = `${currentPlay.id}:${audience}`
            if (explanationByPlayIdRef.current.has(key)) return
            if (!currentPlay.text) return
            if (inFlightExplainRef.current.has(key)) return

            inFlightExplainRef.current.add(key)
            try {
                const playIndex = plays.findIndex((play) => play.id === currentPlay.id)
                const recentPlays =
                    playIndex > 0
                        ? plays.slice(Math.max(0, playIndex - 5), playIndex).map(toAgentPlay)
                        : []
                const data = await apiFetchJson('/api/explain-play', {
                    method: 'POST',
                    body: {
                        play: toAgentPlay(currentPlay),
                        recentPlays,
                        audience,
                        sessionId,
                    },
                })
                const exp = data?.explanation || null
                if (exp) {
                    explanationByPlayIdRef.current.set(key, exp)
                    setExplanationVersion((version) => version + 1)
                }
            } catch (err) {
                console.warn('Explain failed:', err)
            } finally {
                inFlightExplainRef.current.delete(key)
            }
        }

        maybeExplain()
    }, [audience, currentPlay, plays, sessionId])

    const playbackIndex = plays.length
        ? Math.max(0, Math.min(analysisEnabled ? analysisIndex : plays.length - 1, plays.length - 1))
        : 0

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
            index: playbackIndex,
            total: plays.length,
            canPrevious: plays.length > 0 && playbackIndex > 0,
            canNext: plays.length > 0 && playbackIndex < plays.length - 1,
            unseenCount: analysisEnabled
                ? Math.max(0, plays.length - playbackIndex - 1)
                : 0,
        },
        pausePlayback,
        resumeLive,
        restartAnalysis,
        selectPlay,
        startAtQuarter,
        stepNext,
        stepPrevious,
    }
}
