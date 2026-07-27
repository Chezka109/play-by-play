function playLabel(play) {
    const type = play?.parsed?.type || play?.typeText || 'play'
    if (type === 'incomplete') return 'incomplete'
    return String(type).toLowerCase()
}

export function PlayList({ plays, currentPlayId, onSelectPlay }) {
    const items = (plays || []).slice().reverse()

    return (
        <section className="overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white shadow-[0_12px_45px_rgba(28,25,23,0.06)]">
            <div className="flex items-end justify-between border-b border-stone-200 px-4 py-4">
                <div>
                    <h2 className="text-sm font-bold text-stone-950">Play timeline</h2>
                    <p className="mt-0.5 text-xs text-stone-500">Newest first · selecting pauses the display</p>
                </div>
                <span className="rounded-full bg-stone-100 px-2 py-1 text-[0.65rem] font-bold text-stone-500">
                    {items.length}
                </span>
            </div>

            <div className="max-h-[48rem] overflow-auto">
                {items.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                        <div className="mx-auto grid size-10 place-items-center rounded-full bg-stone-100 text-stone-400">
                            ···
                        </div>
                        <p className="mt-3 text-sm font-medium text-stone-600">No plays yet</p>
                        <p className="mt-1 text-xs leading-5 text-stone-400">
                            For upcoming games, the feed begins at kickoff.
                        </p>
                    </div>
                ) : (
                    <ol className="divide-y divide-stone-100">
                        {items.map((play) => {
                            const active = play.id === currentPlayId
                            return (
                                <li key={play.id}>
                                    <button
                                        type="button"
                                        onClick={() => onSelectPlay?.(play.id)}
                                        className={`w-full px-4 py-3 text-left transition ${
                                            active
                                                ? 'bg-emerald-50'
                                                : 'bg-white hover:bg-stone-50'
                                        }`}
                                        aria-current={active ? 'true' : undefined}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 text-[0.65rem] font-semibold text-stone-500">
                                                {play.quarter != null && play.clock ? (
                                                    <span>Q{play.quarter} · {play.clock}</span>
                                                ) : null}
                                                {play.down != null && play.distance != null ? (
                                                    <span>· {play.down}&amp;{play.distance}</span>
                                                ) : null}
                                            </div>
                                            <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] ${
                                                active
                                                    ? 'bg-emerald-700 text-white'
                                                    : 'bg-stone-100 text-stone-500'
                                            }`}>
                                                {playLabel(play)}
                                            </span>
                                        </div>
                                        <p className="mt-1.5 line-clamp-3 text-sm leading-5 text-stone-700">
                                            {play.text}
                                        </p>
                                    </button>
                                </li>
                            )
                        })}
                    </ol>
                )}
            </div>
        </section>
    )
}
