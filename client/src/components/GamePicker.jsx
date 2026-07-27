function GameSelect({ label, placeholder, games, selectedEventId, onSelectEventId, disabled }) {
    const gameIds = new Set((games || []).map((game) => game.id))
    const value = selectedEventId && gameIds.has(selectedEventId) ? selectedEventId : ''

    return (
        <div>
            <label className="block text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-stone-500">
                {label}
            </label>
            <select
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 disabled:cursor-not-allowed disabled:opacity-50"
                value={value}
                onChange={(event) => onSelectEventId(event.target.value || null)}
                disabled={disabled}
            >
                <option value="">{placeholder}</option>
                {(games || []).map((game) => (
                    <option key={game.id} value={game.id}>
                        {game.label || game.shortName || game.name}
                    </option>
                ))}
            </select>
        </div>
    )
}

export function GamePicker({
    liveGames,
    upcomingGames,
    previousGames,
    selectedEventId,
    onSelectEventId,
    disabled,
}) {
    return (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <GameSelect
                label="Live now"
                placeholder="No game in progress"
                games={liveGames}
                selectedEventId={selectedEventId}
                onSelectEventId={onSelectEventId}
                disabled={disabled || liveGames.length === 0}
            />
            <GameSelect
                label="Upcoming"
                placeholder="Choose an upcoming game"
                games={upcomingGames}
                selectedEventId={selectedEventId}
                onSelectEventId={onSelectEventId}
                disabled={disabled || upcomingGames.length === 0}
            />
            <GameSelect
                label="Recent games"
                placeholder="Choose a finished game"
                games={previousGames}
                selectedEventId={selectedEventId}
                onSelectEventId={onSelectEventId}
                disabled={disabled || previousGames.length === 0}
            />
        </div>
    )
}
