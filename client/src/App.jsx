import { FieldCanvas } from './components/FieldCanvas'
import { GamePicker } from './components/GamePicker'
import { CurrentPlay } from './components/CurrentPlay'
import { PlayList } from './components/PlayList'
import { useGamePlays } from './hooks/useGamePlays'
import { useNflGames } from './hooks/useNflGames'

function App() {
  const games = useNflGames({ pollMs: 30000 })

  const {
    eventId,
    setEventId,
    mode,
    status,
    plays,
    currentPlay,
    explanation,
    restartAnalysis,
    startAtQuarter,
  } = useGamePlays({
    pollMs: 5000,
    limit: 60,
  })

  const selectedGame = games.byId.get(eventId) || null

  return (
    <div className="min-h-svh bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-3xl px-4 py-4 sm:py-6">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">Play by Play</div>
            <div className="text-sm text-neutral-400">
              Live NFL plays with simple explanations
            </div>
            <div className="mt-2 text-xs text-neutral-500">
              Selected game: {selectedGame?.shortName || selectedGame?.name || eventId}
            </div>
          </div>
          <div className="text-right text-xs text-neutral-500">
            {status.lastError ? (
              <div className="max-w-[18rem]">{status.lastError}</div>
            ) : (
              <div>{mode === 'mock' ? 'Using mock plays' : 'Connected to backend'}</div>
            )}
            {games.lastError ? (
              <div className="mt-1 max-w-[18rem] text-neutral-600">
                Game list error: {games.lastError}
              </div>
            ) : null}
          </div>
        </header>

        <div className="mb-4">
          <GamePicker
            liveGames={games.live}
            upcomingGames={games.upcoming}
            previousGames={games.previous}
            selectedEventId={eventId}
            onSelectEventId={(id) => id && setEventId(id)}
            disabled={Boolean(games.lastError)}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              className="rounded-lg border border-white/10 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-100 hover:bg-white/5"
              onClick={restartAnalysis}
              disabled={plays.length === 0}
              title="Replay from the beginning of the play-by-play"
            >
              Restart analysis
            </button>

            <button
              className="rounded-lg border border-white/10 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-100 hover:bg-white/5"
              onClick={() => startAtQuarter(1)}
              disabled={plays.length === 0}
            >
              Start at Q1
            </button>
            <button
              className="rounded-lg border border-white/10 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-100 hover:bg-white/5"
              onClick={() => startAtQuarter(2)}
              disabled={plays.length === 0}
            >
              Start at Q2
            </button>
            <button
              className="rounded-lg border border-white/10 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-100 hover:bg-white/5"
              onClick={() => startAtQuarter(3)}
              disabled={plays.length === 0}
            >
              Start at Q3
            </button>
            <button
              className="rounded-lg border border-white/10 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-100 hover:bg-white/5"
              onClick={() => startAtQuarter(4)}
              disabled={plays.length === 0}
            >
              Start at Q4
            </button>
          </div>
        </div>

        {/* TOP: Field visualization */}
        <FieldCanvas play={currentPlay} />

        {/* MIDDLE: Current play + explanation */}
        <div className="mt-4">
          <CurrentPlay play={currentPlay} explanation={explanation} mode={mode} />
        </div>

        {/* BOTTOM: Scrollable list */}
        <div className="mt-4">
          <PlayList plays={plays} currentPlayId={currentPlay?.id || null} />
        </div>
      </div>
    </div>
  )
}

export default App
