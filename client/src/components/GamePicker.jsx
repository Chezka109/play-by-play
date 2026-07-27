export function GamePicker({
    liveGames,
    previousGames,
    selectedEventId,
    onSelectEventId,
    disabled,
}) {
    const liveIds = new Set((liveGames || []).map((g) => g.id))
    const prevIds = new Set((previousGames || []).map((g) => g.id))

    const liveValue = selectedEventId && liveIds.has(selectedEventId) ? selectedEventId : ''
    const prevValue = selectedEventId && prevIds.has(selectedEventId) ? selectedEventId : ''

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
                <label className="block text-xs text-neutral-400">Live games</label>
                <select
                    className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900/40 px-3 py-2 text-sm text-neutral-100"
                    value={liveValue}
                    onChange={(e) => onSelectEventId(e.target.value || null)}
                    disabled={disabled}
                >
                    <option value="">Select a live/upcoming game…</option>
                    {(liveGames || []).map((g) => (
                        <option key={g.id} value={g.id}>
                            {g.label || g.shortName || g.name}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-xs text-neutral-400">Previous games</label>
                <select
                    className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900/40 px-3 py-2 text-sm text-neutral-100"
                    value={prevValue}
                    onChange={(e) => onSelectEventId(e.target.value || null)}
                    disabled={disabled}
                >
                    <option value="">Select a finished game…</option>
                    {(previousGames || []).map((g) => (
                        <option key={g.id} value={g.id}>
                            {g.label || g.shortName || g.name}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    )
}
