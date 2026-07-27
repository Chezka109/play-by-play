function ConfidenceBadge({ confidence }) {
    const styles = {
        high: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        medium: 'border-amber-200 bg-amber-50 text-amber-800',
        low: 'border-stone-200 bg-stone-100 text-stone-600',
    }

    if (!confidence) return null

    return (
        <span
            className={`rounded-full border px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${styles[confidence] || styles.low}`}
        >
            {confidence} confidence
        </span>
    )
}

function AnalysisCard({ label, children }) {
    if (!children) return null
    return (
        <div className="rounded-2xl border border-stone-200/80 bg-stone-50 p-4">
            <div className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-stone-500">
                {label}
            </div>
            <div className="mt-2 text-sm leading-6 text-stone-700">{children}</div>
        </div>
    )
}

export function CurrentPlay({ play, explanation, mode }) {
    const downDist =
        play?.down != null && play?.distance != null
            ? `${play.down}${ordinal(play.down)} & ${play.distance}`
            : null
    const analysis =
        typeof explanation === 'string' ? { summary: explanation } : explanation

    return (
        <section className="overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
            <div className="border-b border-stone-200 bg-stone-950 px-5 py-4 text-stone-100 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-300">
                        <span className="rounded-full bg-white/10 px-2 py-1 font-semibold uppercase tracking-[0.12em]">
                            {mode === 'mock' ? 'Demo feed' : 'Live feed'}
                        </span>
                        {play?.quarter != null && play?.clock ? (
                            <span>Q{play.quarter} · {play.clock}</span>
                        ) : null}
                        {downDist ? <span>· {downDist}</span> : null}
                        {play?.possessionText ? <span>· {play.possessionText}</span> : null}
                    </div>
                    <span className="font-mono text-[0.65rem] text-stone-500">
                        {play?.id || ''}
                    </span>
                </div>

                <p className="mt-4 text-lg font-medium leading-7 text-white sm:text-xl">
                    {play?.text || 'Waiting for the next play…'}
                </p>
            </div>

            <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-emerald-700">
                            Field Guide analysis
                        </div>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                            {analysis?.headline || (play ? 'Reading the play…' : 'Game insight')}
                        </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {analysis?.meta?.degraded ? (
                            <span className="rounded-full border border-stone-200 bg-white px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-stone-500">
                                Local analyst
                            </span>
                        ) : analysis?.meta?.source === 'openai' ? (
                            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-violet-700">
                                AI agent
                            </span>
                        ) : null}
                        <ConfidenceBadge confidence={analysis?.confidence} />
                    </div>
                </div>

                <p className="mt-4 max-w-2xl text-base leading-7 text-stone-700">
                    {analysis?.summary || (play ? 'The agent is checking the play facts and game situation.' : 'Choose a game to begin.')}
                </p>

                {analysis ? (
                    <>
                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                            <AnalysisCard label="Why it matters">
                                {analysis.whyItMatters}
                            </AnalysisCard>
                            <AnalysisCard label="The football idea">
                                {analysis.strategy}
                            </AnalysisCard>
                        </div>

                        {analysis.concepts?.length ? (
                            <div className="mt-5">
                                <div className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-stone-500">
                                    Terms in this play
                                </div>
                                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                                    {analysis.concepts.map((concept) => (
                                        <div
                                            key={concept.term}
                                            className="rounded-xl border border-stone-200 px-3 py-3"
                                        >
                                            <dt className="text-sm font-semibold capitalize text-stone-950">
                                                {concept.term}
                                            </dt>
                                            <dd className="mt-1 text-xs leading-5 text-stone-600">
                                                {concept.definition}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        ) : null}

                        {analysis.watchFor ? (
                            <div className="mt-5 flex gap-3 rounded-2xl bg-emerald-950 px-4 py-3 text-sm leading-6 text-emerald-50">
                                <span aria-hidden="true">→</span>
                                <p><strong>Watch next:</strong> {analysis.watchFor}</p>
                            </div>
                        ) : null}
                    </>
                ) : null}
            </div>
        </section>
    )
}

function ordinal(number) {
    if (number === 1) return 'st'
    if (number === 2) return 'nd'
    if (number === 3) return 'rd'
    return 'th'
}
