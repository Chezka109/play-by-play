function ControlButton({ children, disabled, onClick, title }) {
    return (
        <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-4 text-xs font-bold text-stone-700 shadow-sm transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-35"
            disabled={disabled}
            onClick={onClick}
            title={title}
        >
            {children}
        </button>
    )
}

export function PlaybackControls({
    playback,
    onPause,
    onPrevious,
    onNext,
    onResumeLive,
}) {
    const paused = playback.enabled
    const hasPlays = playback.total > 0
    const position = hasPlays ? playback.index + 1 : 0

    return (
        <section
            aria-label="Play navigation"
            className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
            <div className="flex min-w-0 items-center gap-3">
                <span
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.12em] ${
                        paused
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                    }`}
                >
                    <span
                        className={`size-1.5 rounded-full ${
                            paused ? 'bg-amber-500' : 'animate-pulse bg-emerald-600'
                        }`}
                    />
                    {paused ? 'Paused' : 'Following live'}
                </span>
                <div className="min-w-0">
                    <p className="text-sm font-bold text-stone-900">
                        {hasPlays ? `Play ${position} of ${playback.total}` : 'Waiting for the first play'}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                        {paused
                            ? playback.unseenCount > 0
                                ? `${playback.unseenCount} newer ${playback.unseenCount === 1 ? 'play' : 'plays'} waiting`
                                : 'New plays will wait while you review'
                            : 'The display moves forward when a new play arrives'}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                <ControlButton
                    disabled={!playback.canPrevious}
                    onClick={onPrevious}
                    title="Show the previous play"
                >
                    <span aria-hidden="true">←</span>
                    Previous
                </ControlButton>

                {paused ? (
                    <button
                        type="button"
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-35"
                        disabled={!hasPlays}
                        onClick={onResumeLive}
                    >
                        <span aria-hidden="true">●</span>
                        Jump to live
                    </button>
                ) : (
                    <button
                        type="button"
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-stone-900 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-35"
                        disabled={!hasPlays}
                        onClick={onPause}
                    >
                        <span aria-hidden="true">Ⅱ</span>
                        Pause display
                    </button>
                )}

                <ControlButton
                    disabled={!playback.canNext}
                    onClick={onNext}
                    title="Show the next play"
                >
                    Next
                    <span aria-hidden="true">→</span>
                </ControlButton>
            </div>
        </section>
    )
}
