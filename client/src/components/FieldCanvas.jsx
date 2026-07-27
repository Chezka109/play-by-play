import { useEffect, useMemo, useRef } from 'react'

function clamp(number, min, max) {
    return Math.max(min, Math.min(max, number))
}

function cssVar(name, fallback) {
    return (
        getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
        fallback
    )
}

function inferScene(play) {
    const parsed = play?.parsed || {}
    const yards = Number.isFinite(parsed.yards) ? parsed.yards : 0
    const yardLineValue = Number(play?.yardLine)

    return {
        type: parsed.type || 'unknown',
        direction: parsed.direction || 'middle',
        yards,
        yardLine: Number.isFinite(yardLineValue)
            ? clamp(yardLineValue, 0, 100)
            : 50,
        distance: Number.isFinite(Number(play?.distance))
            ? Number(play.distance)
            : null,
    }
}

function drawField(ctx, { width, height, lineOfScrimmageX, firstDownX }) {
    const field = cssVar('--field-bg', '#174f38')
    const stripe = cssVar('--field-stripe', 'rgba(255,255,255,.025)')
    const fieldLine = cssVar('--field-line', 'rgba(255,255,255,.2)')
    const endZone = cssVar('--field-endzone', 'rgba(7,27,20,.58)')

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = field
    ctx.fillRect(0, 0, width, height)

    const endZoneWidth = width / 12
    const playingWidth = width - endZoneWidth * 2

    for (let yard = 0; yard < 100; yard += 10) {
        if ((yard / 10) % 2 === 0) {
            ctx.fillStyle = stripe
            ctx.fillRect(
                endZoneWidth + (yard / 100) * playingWidth,
                0,
                playingWidth / 10,
                height
            )
        }
    }

    ctx.fillStyle = endZone
    ctx.fillRect(0, 0, endZoneWidth, height)
    ctx.fillRect(width - endZoneWidth, 0, endZoneWidth, height)

    ctx.strokeStyle = fieldLine
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let yard = 0; yard <= 100; yard += 10) {
        const x = endZoneWidth + (yard / 100) * playingWidth
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
    }
    for (let yard = 5; yard < 100; yard += 5) {
        const x = endZoneWidth + (yard / 100) * playingWidth
        for (const y of [height * 0.08, height * 0.39, height * 0.61, height * 0.92]) {
            ctx.moveTo(x, y - 3)
            ctx.lineTo(x, y + 3)
        }
    }
    ctx.stroke()

    ctx.fillStyle = 'rgba(255,255,255,.34)'
    ctx.font = `700 ${Math.max(9, height * 0.045)}px ui-monospace, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let yard = 10; yard < 100; yard += 10) {
        const x = endZoneWidth + (yard / 100) * playingWidth
        const label = yard <= 50 ? yard : 100 - yard
        ctx.fillText(String(label), x, height * 0.16)
        ctx.fillText(String(label), x, height * 0.84)
    }

    ctx.save()
    ctx.translate(endZoneWidth / 2, height / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = 'rgba(255,255,255,.28)'
    ctx.font = `800 ${Math.max(8, height * 0.04)}px system-ui`
    ctx.letterSpacing = '2px'
    ctx.fillText('END ZONE', 0, 0)
    ctx.restore()

    ctx.save()
    ctx.translate(width - endZoneWidth / 2, height / 2)
    ctx.rotate(Math.PI / 2)
    ctx.fillStyle = 'rgba(255,255,255,.28)'
    ctx.font = `800 ${Math.max(8, height * 0.04)}px system-ui`
    ctx.fillText('END ZONE', 0, 0)
    ctx.restore()

    if (firstDownX != null) {
        ctx.strokeStyle = cssVar('--field-first-down', '#facc15')
        ctx.lineWidth = 2
        ctx.setLineDash([6, 5])
        ctx.beginPath()
        ctx.moveTo(firstDownX, 0)
        ctx.lineTo(firstDownX, height)
        ctx.stroke()
        ctx.setLineDash([])
    }

    ctx.strokeStyle = cssVar('--field-los', '#60a5fa')
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(lineOfScrimmageX, 0)
    ctx.lineTo(lineOfScrimmageX, height)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(255,255,255,.32)'
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1)
}

function drawPlayer(ctx, { x, y, radius, fill, outline = 'rgba(255,255,255,.75)' }) {
    ctx.fillStyle = fill
    ctx.strokeStyle = outline
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
}

function drawPath(ctx, { start, end, progress }) {
    const currentX = start.x + (end.x - start.x) * progress
    const currentY = start.y + (end.y - start.y) * progress
    ctx.strokeStyle = cssVar('--field-ball', '#facc15')
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.setLineDash([6, 5])
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(currentX, currentY)
    ctx.stroke()
    ctx.setLineDash([])
}

export function FieldCanvas({ play }) {
    const canvasRef = useRef(null)
    const scene = useMemo(() => inferScene(play), [play])

    useEffect(() => {
        const canvas = canvasRef.current
        const context = canvas?.getContext('2d')
        if (!canvas || !context) return

        let animationFrame = null
        let startTime = null
        let dimensions = { width: 1, height: 1 }
        let disposed = false

        function resize() {
            const rect = canvas.getBoundingClientRect()
            const width = Math.max(1, Math.floor(rect.width))
            const height = Math.max(1, Math.floor(rect.height))
            const density = window.devicePixelRatio || 1
            canvas.width = Math.floor(width * density)
            canvas.height = Math.floor(height * density)
            context.setTransform(density, 0, 0, density, 0, 0)
            dimensions = { width, height }
        }

        function geometry() {
            const { width, height } = dimensions
            const endZoneWidth = width / 12
            const playingWidth = width - endZoneWidth * 2
            const lineOfScrimmageX =
                endZoneWidth + (scene.yardLine / 100) * playingWidth
            const firstDownX =
                scene.distance == null
                    ? null
                    : clamp(
                          lineOfScrimmageX + (scene.distance / 100) * playingWidth,
                          endZoneWidth,
                          endZoneWidth + playingWidth
                      )
            return { width, height, endZoneWidth, playingWidth, lineOfScrimmageX, firstDownX }
        }

        function render(progress = 1) {
            const {
                width,
                height,
                endZoneWidth,
                playingWidth,
                lineOfScrimmageX,
                firstDownX,
            } = geometry()
            drawField(context, { width, height, lineOfScrimmageX, firstDownX })

            if (!play) return

            const offense = cssVar('--field-offense', '#f8fafc')
            const defense = cssVar('--field-defense', '#fb7185')
            const radius = clamp(height * 0.025, 5, 9)
            const quarterback = {
                x: clamp(lineOfScrimmageX - playingWidth * 0.035, endZoneWidth, width - endZoneWidth),
                y: height * 0.5,
            }
            const runner = {
                x: clamp(lineOfScrimmageX - playingWidth * 0.025, endZoneWidth, width - endZoneWidth),
                y: height * 0.68,
            }
            const receiver = {
                x: clamp(lineOfScrimmageX + playingWidth * 0.075, endZoneWidth, width - endZoneWidth),
                y:
                    scene.direction === 'left'
                        ? height * 0.3
                        : scene.direction === 'right'
                          ? height * 0.7
                          : height * 0.48,
            }
            const endX = clamp(
                lineOfScrimmageX + (scene.yards / 100) * playingWidth,
                endZoneWidth,
                endZoneWidth + playingWidth
            )

            for (const y of [0.28, 0.42, 0.58, 0.72]) {
                drawPlayer(context, {
                    x: lineOfScrimmageX + playingWidth * 0.018,
                    y: height * y,
                    radius: radius * 0.82,
                    fill: defense,
                })
            }

            const eased =
                progress < 0.5
                    ? 2 * progress * progress
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2

            if (['pass', 'interception', 'incomplete'].includes(scene.type)) {
                const target = {
                    x: scene.type === 'incomplete' ? receiver.x : Math.max(receiver.x, endX),
                    y: receiver.y,
                }
                const receiverPosition = {
                    x: receiver.x + (target.x - receiver.x) * eased,
                    y: receiver.y,
                }
                drawPlayer(context, { ...quarterback, radius, fill: offense })
                drawPlayer(context, { ...runner, radius: radius * 0.85, fill: offense })
                drawPlayer(context, { ...receiverPosition, radius, fill: offense })
                drawPath(context, {
                    start: quarterback,
                    end: receiver,
                    progress: clamp(progress / 0.68, 0, 1),
                })
            } else {
                const carrierStart = scene.type === 'sack' ? quarterback : runner
                const carrierEnd = { x: endX, y: carrierStart.y }
                const carrier = {
                    x: carrierStart.x + (carrierEnd.x - carrierStart.x) * eased,
                    y: carrierStart.y,
                }
                drawPlayer(context, { ...quarterback, radius, fill: offense })
                drawPlayer(context, { ...runner, radius: radius * 0.85, fill: offense })
                drawPlayer(context, { ...carrier, radius: radius * 1.08, fill: offense })
                drawPath(context, {
                    start: carrierStart,
                    end: carrierEnd,
                    progress: eased,
                })
            }
        }

        function animate(timestamp) {
            if (disposed) return
            if (startTime == null) startTime = timestamp
            const progress = clamp((timestamp - startTime) / 1350, 0, 1)
            render(progress)
            if (progress < 1) animationFrame = requestAnimationFrame(animate)
        }

        resize()
        render(play ? 0 : 1)
        if (play) animationFrame = requestAnimationFrame(animate)

        const observer = new ResizeObserver(() => {
            resize()
            render(1)
        })
        observer.observe(canvas)

        return () => {
            disposed = true
            observer.disconnect()
            if (animationFrame) cancelAnimationFrame(animationFrame)
        }
    }, [play, scene])

    return (
        <figure className="overflow-hidden rounded-[1.5rem] border border-emerald-950/20 bg-emerald-950 shadow-[0_18px_60px_rgba(7,27,20,0.16)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-emerald-100/65">
                <span>Play visualizer</span>
                <span className="flex items-center gap-3">
                    <span><i className="mr-1 inline-block size-2 rounded-full bg-slate-50" /> offense</span>
                    <span><i className="mr-1 inline-block size-2 rounded-full bg-rose-400" /> defense</span>
                </span>
            </div>
            <div className="h-56 w-full sm:h-64 md:h-72">
                <canvas
                    ref={canvasRef}
                    className="size-full"
                    role="img"
                    aria-label={play ? `Animated diagram for: ${play.text}` : 'Empty football field'}
                />
            </div>
        </figure>
    )
}
