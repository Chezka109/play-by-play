export function CurrentPlay({ play, explanation, mode }) {
    const downDist =
        play?.down != null && play?.distance != null
            ? `${play.down}${ordinal(play.down)} & ${play.distance}`
            : null

    return (
        <div className="rounded-xl border border-white/10 bg-neutral-900/40 p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-neutral-400">
                    {mode === 'mock' ? 'Mock mode' : 'Live mode'}
                    {play?.quarter != null && play?.clock ? (
                        <span className="ml-2">Q{play.quarter} · {play.clock}</span>
                    ) : null}
                    {downDist ? <span className="ml-2">· {downDist}</span> : null}
                    {play?.possessionText ? <span className="ml-2">· {play.possessionText}</span> : null}
                </div>
                <div className="text-xs text-neutral-500">{play?.id || ''}</div>
            </div>

            <div className="mt-3 text-lg leading-snug text-neutral-100">
                {play?.text || 'Waiting for plays…'}
            </div>

            <div className="mt-3 text-sm text-neutral-200/90">
                <div className="text-xs uppercase tracking-wide text-neutral-400">Simple explanation</div>
                <div className="mt-1">
                    {explanation || (play ? 'Generating explanation…' : '—')}
                </div>
            </div>
        </div>
    )
}

function ordinal(n) {
    if (n === 1) return 'st'
    if (n === 2) return 'nd'
    if (n === 3) return 'rd'
    return 'th'
}
