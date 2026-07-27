import { useEffect, useMemo, useRef } from 'react'

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n))
}

function getCssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim()
    return v || fallback
}

function drawField(ctx, { w, h, lineOfScrimmageX }) {
    const fieldBg = getCssVar('--field-bg', '#0b3d2e')
    const fieldLine = getCssVar('--field-line', 'rgba(255,255,255,0.2)')
    const endzone = getCssVar('--field-endzone', 'rgba(255,255,255,0.08)')
    const los = getCssVar('--field-los', 'rgba(255,255,255,0.65)')

    ctx.clearRect(0, 0, w, h)

    // Background
    ctx.fillStyle = fieldBg
    ctx.fillRect(0, 0, w, h)

    // End zones (10 yards each of 120 total)
    const endZoneW = w * (10 / 120)
    ctx.fillStyle = endzone
    ctx.fillRect(0, 0, endZoneW, h)
    ctx.fillRect(w - endZoneW, 0, endZoneW, h)

    // Yard lines (every 10 yards across 120)
    ctx.strokeStyle = fieldLine
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i <= 12; i++) {
        const x = (w * i) / 12
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
    }
    ctx.stroke()

    // Line of scrimmage
    ctx.strokeStyle = los
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(lineOfScrimmageX, 0)
    ctx.lineTo(lineOfScrimmageX, h)
    ctx.stroke()
}

function drawCircle(ctx, { x, y, r, fill }) {
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
}

function drawBallPath(ctx, { x1, y1, x2, y2, t }) {
    const ball = getCssVar('--field-ball', '#facc15')
    ctx.strokeStyle = ball
    ctx.lineWidth = 3
    ctx.lineCap = 'round'

    const mx = x1 + (x2 - x1) * t
    const my = y1 + (y2 - y1) * t

    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(mx, my)
    ctx.stroke()
}

function inferScene(play) {
    const parsed = play?.parsed || {}
    const yards = Number.isFinite(parsed?.yards) ? parsed.yards : 0
    const direction = parsed?.direction || 'middle'
    const type = parsed?.type || 'unknown'

    // If yardLine is 0-100 from ESPN, map to the middle 100 yards inside a 120-yard canvas.
    const yl = Number(play?.yardLine)
    const yardLine = Number.isFinite(yl) ? clamp(yl, 0, 100) : 50

    return { type, direction, yards, yardLine }
}

export function FieldCanvas({ play }) {
    const canvasRef = useRef(null)
    const animRef = useRef({ raf: null, startTs: null, playId: null })

    const scene = useMemo(() => inferScene(play), [play])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1

        function resizeToContainer() {
            const rect = canvas.getBoundingClientRect()
            const w = Math.max(1, Math.floor(rect.width))
            const h = Math.max(1, Math.floor(rect.height))
            canvas.width = Math.floor(w * dpr)
            canvas.height = Math.floor(h * dpr)
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            return { w, h }
        }

        const { w, h } = resizeToContainer()

        const endZoneW = w * (10 / 120)
        const fieldStartX = endZoneW
        const fieldW = w - endZoneW * 2

        const lineOfScrimmageX = fieldStartX + (scene.yardLine / 100) * fieldW

        const offense = getCssVar('--field-offense', 'rgba(255,255,255,0.9)')
        const defense = getCssVar('--field-defense', 'rgba(255,255,255,0.35)')

        // Starting positions (simple, approximate)
        const qb = { x: lineOfScrimmageX - fieldW * 0.03, y: h * 0.55 }
        const rb = { x: lineOfScrimmageX - fieldW * 0.02, y: h * 0.70 }

        const wrY = scene.direction === 'left' ? h * 0.35 : scene.direction === 'right' ? h * 0.75 : h * 0.50
        const wr = { x: lineOfScrimmageX + fieldW * 0.07, y: wrY }

        const def1 = { x: lineOfScrimmageX + fieldW * 0.02, y: h * 0.45 }
        const def2 = { x: lineOfScrimmageX + fieldW * 0.02, y: h * 0.65 }

        // End position based on yards (assume offense moves to the right)
        const endX = clamp(lineOfScrimmageX + (scene.yards / 100) * fieldW, fieldStartX, fieldStartX + fieldW)

        const durationMs = 1400

        function renderFrame(ts) {
            if (!animRef.current.startTs) animRef.current.startTs = ts
            const tRaw = (ts - animRef.current.startTs) / durationMs
            const t = clamp(tRaw, 0, 1)
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

            drawField(ctx, { w, h, lineOfScrimmageX })

            // Defense stays put
            drawCircle(ctx, { x: def1.x, y: def1.y, r: 7, fill: defense })
            drawCircle(ctx, { x: def2.x, y: def2.y, r: 7, fill: defense })

            if (!play) {
                animRef.current.raf = requestAnimationFrame(renderFrame)
                return
            }

            if (scene.type === 'pass' || scene.type === 'interception' || scene.type === 'incomplete') {
                // QB stays mostly in place
                drawCircle(ctx, { x: qb.x, y: qb.y, r: 8, fill: offense })
                drawCircle(ctx, { x: rb.x, y: rb.y, r: 7, fill: offense })

                // Receiver runs forward a bit for completed pass
                const wrRunX = scene.type === 'incomplete' ? wr.x : clamp(endX, wr.x, fieldStartX + fieldW)
                const wrX = wr.x + (wrRunX - wr.x) * ease
                const wrY2 = wr.y

                drawCircle(ctx, { x: wrX, y: wrY2, r: 8, fill: offense })

                // Ball path: QB -> WR (first half), then along WR run (second half) for completed
                if (t <= 0.55) {
                    const t1 = clamp(t / 0.55, 0, 1)
                    drawBallPath(ctx, { x1: qb.x, y1: qb.y, x2: wr.x, y2: wr.y, t: t1 })
                } else if (scene.type !== 'incomplete') {
                    const t2 = clamp((t - 0.55) / 0.45, 0, 1)
                    drawBallPath(ctx, { x1: wr.x, y1: wr.y, x2: wrRunX, y2: wr.y, t: t2 })
                } else {
                    drawBallPath(ctx, { x1: qb.x, y1: qb.y, x2: wr.x, y2: wr.y, t: 1 })
                }
            } else {
                // Rush / sack / unknown: move ball-carrier forward (or backward for negative)
                const isSack = scene.type === 'sack'
                const carrierStart = isSack ? qb : rb
                const carrierEndX = endX
                const carrierX = carrierStart.x + (carrierEndX - carrierStart.x) * ease
                const carrierY = carrierStart.y

                drawCircle(ctx, { x: qb.x, y: qb.y, r: 8, fill: offense })
                drawCircle(ctx, { x: rb.x, y: rb.y, r: 7, fill: offense })
                drawCircle(ctx, { x: carrierX, y: carrierY, r: 9, fill: offense })

                drawBallPath(ctx, { x1: carrierStart.x, y1: carrierStart.y, x2: carrierEndX, y2: carrierStart.y, t: ease })
            }

            if (t < 1) {
                animRef.current.raf = requestAnimationFrame(renderFrame)
            } else {
                // Reset field after animation completes
                setTimeout(() => {
                    const { w: w2, h: h2 } = resizeToContainer()
                    drawField(ctx, { w: w2, h: h2, lineOfScrimmageX })
                }, 400)
            }
        }

        // Cancel any previous animation and start a new one when play changes
        if (animRef.current.raf) cancelAnimationFrame(animRef.current.raf)
        animRef.current.startTs = null
        animRef.current.playId = play?.id || null

        drawField(ctx, { w, h, lineOfScrimmageX })
        animRef.current.raf = requestAnimationFrame(renderFrame)

        const onResize = () => {
            const { w: w2, h: h2 } = resizeToContainer()
            const losX2 = fieldStartX + (scene.yardLine / 100) * (w2 - (w2 * (10 / 120)) * 2)
            drawField(ctx, { w: w2, h: h2, lineOfScrimmageX: losX2 })
        }

        window.addEventListener('resize', onResize)
        return () => {
            window.removeEventListener('resize', onResize)
            if (animRef.current.raf) cancelAnimationFrame(animRef.current.raf)
        }
    }, [play, scene])

    return (
        <div className="w-full h-64 sm:h-72 md:h-80 rounded-xl overflow-hidden border border-white/10 bg-neutral-950">
            <canvas ref={canvasRef} className="w-full h-full" />
        </div>
    )
}
