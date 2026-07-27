function Team({ team, align = 'left' }) {
    return (
        <div
            className={`flex min-w-0 items-center gap-3 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}
        >
            <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm sm:size-14">
                {team?.logo ? (
                    <img
                        className="size-10 object-contain sm:size-12"
                        src={team.logo}
                        alt=""
                    />
                ) : (
                    <span className="text-sm font-black text-stone-500">
                        {team?.abbreviation || '—'}
                    </span>
                )}
            </div>
            <div className="min-w-0">
                <div className="truncate text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                    {team?.abbreviation || 'TBD'}
                </div>
                <div className="truncate text-sm font-semibold text-stone-950 sm:text-base">
                    {team?.shortDisplayName || team?.displayName || 'Team TBD'}
                </div>
            </div>
        </div>
    )
}

function formatKickoff(date) {
    if (!date) return 'Kickoff time TBD'
    const value = new Date(date)
    if (Number.isNaN(value.getTime())) return 'Kickoff time TBD'
    return new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
    }).format(value)
}

function seasonLabel(game) {
    if (Number(game?.seasonType) === 1) return 'Preseason'
    if (Number(game?.seasonType) === 3) return 'Postseason'
    return 'Regular season'
}

export function MatchupCard({ game }) {
    if (!game) {
        return (
            <div className="rounded-[1.5rem] border border-dashed border-stone-300 bg-white/50 p-6 text-center text-sm text-stone-500">
                Choose a game to load its matchup and play feed.
            </div>
        )
    }

    const isLive = game.status?.state === 'in'
    const isFinal = game.status?.state === 'post' || game.status?.completed
    const homeScore = game.teams?.home?.score
    const awayScore = game.teams?.away?.score
    const showScore = isLive || isFinal

    return (
        <section className="overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white shadow-[0_12px_45px_rgba(28,25,23,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-5 py-3 text-xs text-stone-500">
                <span className="font-semibold">
                    {game.seasonYear} {seasonLabel(game)}
                    {game.week ? ` · Week ${game.week}` : ''}
                </span>
                <div className="flex items-center gap-2">
                    {isLive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-1 font-bold uppercase tracking-[0.12em] text-red-700">
                            <span className="size-1.5 animate-pulse rounded-full bg-red-600" />
                            Live
                        </span>
                    ) : null}
                    <span>{game.status?.detail || formatKickoff(game.date)}</span>
                </div>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-5 sm:gap-6 sm:px-7">
                <Team team={game.teams?.away} />
                <div className="text-center">
                    {showScore ? (
                        <div className="font-mono text-2xl font-black tracking-tight text-stone-950 sm:text-3xl">
                            {awayScore ?? '0'} <span className="text-stone-300">–</span>{' '}
                            {homeScore ?? '0'}
                        </div>
                    ) : (
                        <div className="rounded-full bg-stone-100 px-3 py-2 text-[0.65rem] font-black uppercase tracking-[0.16em] text-stone-500">
                            at
                        </div>
                    )}
                    {game.status?.clock ? (
                        <div className="mt-1 text-[0.65rem] font-bold text-stone-500">
                            {game.status.period ? `Q${game.status.period} · ` : ''}
                            {game.status.clock}
                        </div>
                    ) : null}
                </div>
                <Team team={game.teams?.home} align="right" />
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-stone-100 bg-stone-50 px-5 py-3 text-xs text-stone-500 sm:px-7">
                <span>{formatKickoff(game.date)}</span>
                {game.venue?.name ? <span>{game.venue.name}</span> : null}
                {game.broadcasts?.length ? <span>{game.broadcasts.join(' · ')}</span> : null}
            </div>
        </section>
    )
}
