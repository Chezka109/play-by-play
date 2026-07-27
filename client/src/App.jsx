import { useEffect, useMemo, useState } from 'react'
import { CurrentPlay } from './components/CurrentPlay'
import { FieldCanvas } from './components/FieldCanvas'
import { GamePicker } from './components/GamePicker'
import { MatchupCard } from './components/MatchupCard'
import { PlaybackControls } from './components/PlaybackControls'
import { PlayList } from './components/PlayList'
import { useGamePlays } from './hooks/useGamePlays'
import { useNflGames } from './hooks/useNflGames'

function QuarterControls({ plays, onRestart, onStartAtQuarter }) {
  const availableQuarters = useMemo(
    () => new Set(plays.map((play) => Number(play.quarter)).filter(Boolean)),
    [plays],
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onRestart}
        disabled={plays.length === 0}
        type="button"
      >
        First play
      </button>
      {[1, 2, 3, 4].map((quarter) => (
        <button
          key={quarter}
          className="grid size-8 place-items-center rounded-full border border-stone-300 bg-white text-xs font-bold text-stone-600 transition hover:border-emerald-600 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-30"
          onClick={() => onStartAtQuarter(quarter)}
          disabled={!availableQuarters.has(quarter)}
          type="button"
          title={`Jump to the first play of quarter ${quarter}`}
        >
          Q{quarter}
        </button>
      ))}
    </div>
  )
}

function App() {
  const [audience, setAudience] = useState('rookie')
  const games = useNflGames({ pollMs: 30000 })

  const {
    eventId,
    setEventId,
    mode,
    status,
    plays,
    currentPlay,
    explanation,
    analysis,
    pausePlayback,
    resumeLive,
    restartAnalysis,
    selectPlay,
    startAtQuarter,
    stepNext,
    stepPrevious,
  } = useGamePlays({
    pollMs: 5000,
    limit: 80,
    audience,
  })

  const selectedGame = games.byId.get(eventId) || null
  const freshestGame = status.game
    ? {
        ...selectedGame,
        ...status.game,
        teams: {
          home: {
            ...selectedGame?.teams?.home,
            ...status.game?.teams?.home,
          },
          away: {
            ...selectedGame?.teams?.away,
            ...status.game?.teams?.away,
          },
        },
        venue: selectedGame?.venue,
        broadcasts: selectedGame?.broadcasts,
      }
    : selectedGame

  useEffect(() => {
    if (games.loading) return
    if (eventId && games.byId.has(eventId)) return
    const bestGame = games.live[0] || games.upcoming[0] || games.previous[0]
    if (bestGame?.id) setEventId(bestGame.id)
  }, [
    eventId,
    games.byId,
    games.live,
    games.loading,
    games.previous,
    games.upcoming,
    setEventId,
  ])

  const selectedIsLive = freshestGame?.status?.state === 'in'
  const noGames = games.live.length + games.upcoming.length + games.previous.length === 0

  return (
    <div className="min-h-svh bg-[#f3f1eb] text-stone-900">
      <header className="relative overflow-hidden bg-[#0b2118] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 20%, rgba(52,211,153,.22), transparent 28%), radial-gradient(circle at 85% 0%, rgba(250,204,21,.13), transparent 24%)',
          }}
        />
        <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl border border-white/15 bg-white/10 font-black text-emerald-300 shadow-inner">
              P
            </div>
            <div>
              <div className="text-base font-bold tracking-tight">Play by Play</div>
              <div className="text-xs text-emerald-100/60">Football, explained as it happens</div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="hidden text-emerald-100/60 sm:inline">
              {games.meta?.seasonYear ? `${games.meta.seasonYear} NFL season` : 'NFL live feed'}
            </span>
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-semibold ${
              status.lastError || games.lastError
                ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
                : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
            }`}>
              <span className={`size-1.5 rounded-full ${
                status.lastError || games.lastError ? 'bg-amber-300' : 'bg-emerald-300'
              }`} />
              {analysis.enabled
                ? 'Display paused'
                : selectedIsLive
                  ? 'Updating live'
                  : status.lastError || games.lastError
                    ? 'Feed retrying'
                    : 'Feed ready'}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-emerald-700">
                Game center
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">
                Pick a game. Understand every snap.
              </h1>
            </div>
            <p className="max-w-md text-sm leading-6 text-stone-500">
              Live play data is translated into plain language, tactical context, and the terms worth knowing.
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-stone-200 bg-white/70 p-4 shadow-sm backdrop-blur sm:p-5">
            <GamePicker
              liveGames={games.live}
              upcomingGames={games.upcoming}
              previousGames={games.previous}
              selectedEventId={eventId}
              onSelectEventId={(id) => id && setEventId(id)}
              disabled={games.loading && noGames}
            />
            {games.loading ? (
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-emerald-600" />
              </div>
            ) : null}
          </div>

          {games.lastError || status.lastError ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong>The live feed is reconnecting.</strong>{' '}
              Existing plays remain available while the next refresh is attempted.
            </div>
          ) : null}

          <div className="mt-4">
            <MatchupCard game={freshestGame} />
          </div>
        </section>

        <div className="mt-6">
          <PlaybackControls
            playback={analysis}
            onPause={pausePlayback}
            onPrevious={stepPrevious}
            onNext={stepNext}
            onResumeLive={resumeLive}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/70 px-4 py-3">
          <QuarterControls
            plays={plays}
            onRestart={restartAnalysis}
            onStartAtQuarter={startAtQuarter}
          />

          <label className="flex items-center gap-2 text-xs font-semibold text-stone-500">
            Explain for
            <select
              className="rounded-full border border-stone-300 bg-white px-3 py-2 font-semibold text-stone-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
            >
              <option value="rookie">New fan</option>
              <option value="fan">Regular fan</option>
              <option value="coach">Film-room detail</option>
            </select>
          </label>
        </div>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="min-w-0 space-y-5">
            <FieldCanvas play={currentPlay} />
            <CurrentPlay play={currentPlay} explanation={explanation} mode={mode} />
          </div>
          <aside className="lg:sticky lg:top-5">
            <PlayList
              plays={plays}
              currentPlayId={currentPlay?.id || null}
              onSelectPlay={selectPlay}
            />
          </aside>
        </div>
      </main>

      <footer className="border-t border-stone-200 bg-white/40">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-5 text-xs text-stone-400 sm:px-6 lg:px-8">
          <span>Live game data via ESPN · Explanations may make mistakes</span>
          <span>Field Guide · {games.meta?.fetchedAt ? `schedule refreshed ${new Date(games.meta.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'waiting for schedule'}</span>
        </div>
      </footer>
    </div>
  )
}

export default App
