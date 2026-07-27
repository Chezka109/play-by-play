const express = require('express');
const { env } = require('../config/env');

function healthRoutes({ gameWatcher }) {
    const router = express.Router();

    router.get('/', (req, res) => {
        res.json({
            ok: true,
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.round(process.uptime()),
            integrations: {
                scoreboard: 'espn',
                explanations: env.openaiApiKey ? 'openai' : 'local-fallback',
                model: env.openaiApiKey ? env.openaiModel : null,
            },
            watcher: gameWatcher.getDiagnostics(),
        });
    });

    return router;
}

module.exports = healthRoutes;
