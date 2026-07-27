export function PlayList({ plays, currentPlayId }) {
    const items = (plays || []).slice().reverse()

    return (
        <div className="rounded-xl border border-white/10 bg-neutral-900/20">
            <div className="px-4 py-3 border-b border-white/10">
                <div className="text-sm font-medium text-neutral-200">Previous plays</div>
                <div className="text-xs text-neutral-500">Newest at top</div>
            </div>

            <div className="max-h-[38vh] overflow-auto">
                {items.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-neutral-400">No plays yet.</div>
                ) : (
                    <ul className="divide-y divide-white/10">
                        {items.map((p) => {
                            const active = p.id === currentPlayId
                            return (
                                <li key={p.id} className={active ? 'bg-white/5' : ''}>
                                    <div className="px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-xs text-neutral-500">
                                                {p.quarter != null && p.clock ? `Q${p.quarter} · ${p.clock}` : ''}
                                                {p.possessionText ? ` · ${p.possessionText}` : ''}
                                            </div>
                                            <div className="text-[11px] text-neutral-600">{p.id}</div>
                                        </div>
                                        <div className="mt-1 text-sm text-neutral-200">
                                            {p.text}
                                        </div>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>
        </div>
    )
}
