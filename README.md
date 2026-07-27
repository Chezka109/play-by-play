# Play by Play

Play by Play is a live NFL game companion that turns terse play-feed text into clear football explanations. It follows the current game, visualizes the play, explains the result and strategy for different audience levels, and defines the terms that matter.

## What is built

- A season-aware 2026 NFL schedule picker covering preseason, regular season, and postseason
- Adaptive live polling: slow before kickoff, fast in-game, stopped after the final whistle
- Provider correction handling, deduplicated plays, retry backoff, and graceful shutdown
- A context-aware Field Guide agent using OpenAI's Responses API, function tools, structured output, low-latency reasoning, request deduplication, and caching
- A full deterministic football analyst when OpenAI is unavailable
- Beginner, regular-fan, and film-room explanation levels
- A responsive matchup center, animated field, selectable play timeline, and replay controls
- Health diagnostics, explanation rate limits, tests, CI, and a production Docker image

## Architecture

```text
ESPN scoreboard ──> season game index ──> game picker
ESPN summary ─────> adaptive watcher ───> normalized plays ──> React UI
                                             │
                                             └──> Field Guide agent
                                                  ├── inspect_play tool
                                                  ├── football glossary tool
                                                  ├── structured explanation
                                                  └── local fallback
```

The OpenAI API key stays on the server. The browser only calls the app's `/api` routes.

## Local setup

Requirements: Node.js 20.19 or newer and npm.

```bash
npm ci
npm --prefix server ci
npm --prefix client ci
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. The Express API runs on `http://localhost:3001`.

The app works without an OpenAI key using its local analyst. To enable the agent, set `OPENAI_API_KEY` in `.env`. The default is `gpt-5.6-sol` with low reasoning effort; both are configurable. The implementation follows current OpenAI guidance to use the [Responses API](https://developers.openai.com/api/docs/guides/responses-vs-chat-completions) and [GPT-5.6 model guidance](https://developers.openai.com/api/docs/guides/latest-model).

## Agent behavior

For each play, the server supplies the normalized play, down and distance, game status, and up to five recent plays. The model must call `inspect_play` before answering. It can request trusted glossary definitions, then returns a strict schema containing:

- headline and plain-language summary
- observed result
- why the play matters
- likely strategic idea, clearly separated from fact
- up to three defined concepts
- what to watch next
- confidence

Identical requests share in-flight work and use a 30-day in-memory cache. If the model times out, refuses, returns invalid output, or is not configured, the same response schema is generated locally.

## 2026 live-data behavior

The ESPN site scoreboard selects years with the `dates` parameter. An NFL season spans two calendar years, so the server fetches both calendar years and filters using each event's own `season.year`. This avoids a subtle failure where `year=2026` is ignored and 2025 events are returned.

As of July 27, 2026, the integration was exercised against the live endpoint and returned the 2026 Hall of Fame game as the first upcoming event. The ESPN site endpoints are public but undocumented and are not a contracted data service. Both URLs are configurable so a licensed provider can replace them without changing the UI or agent.

## Validation

```bash
npm run check
```

This runs the server tests, client lint, and production build. Tests cover play parsing, schedule mapping and season boundaries, adaptive watcher behavior, provider corrections, agent tool orchestration and schema handling, cache behavior, local fallback, and rate limiting.

## Production

Build and run the single-server image:

```bash
docker build -t play-by-play .
docker run --rm -p 3001:3001 --env-file .env play-by-play
```

The container serves the built React app and API on port 3001. Use `/health` for liveness and integration mode diagnostics. In a reverse-proxy deployment, set `TRUST_PROXY=true` so IP-based explanation rate limits use the forwarded client address.

## Important environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | empty | Enables the OpenAI agent |
| `OPENAI_MODEL` | `gpt-5.6-sol` | Explanation model |
| `OPENAI_REASONING_EFFORT` | `low` | Live latency/quality tradeoff |
| `POLL_INTERVAL_MS` | `5000` | In-game provider poll interval |
| `SCHEDULE_CACHE_MS` | `20000` | Current-season schedule cache |
| `EXPLAIN_RATE_LIMIT_MAX` | `30` | Explanations per IP per window |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed browser origin(s) |
| `SERVE_CLIENT` | `false` | Serve `client/dist` from Express |

See [.env.example](.env.example) for the complete configuration.
