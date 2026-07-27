const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const { env } = require('./config/env');
const healthRoutes = require('./routes/health');
const gameRoutes = require('./routes/games');
const explainRoutes = require('./routes/explain');
const nflRoutes = require('./routes/nfl');

function createApp({ gameWatcher, pollOnRead = false }) {
    const app = express();

    const serveClient = String(process.env.SERVE_CLIENT || '').toLowerCase() === 'true';

    if (env.trustProxy) app.set('trust proxy', 1);
    app.use(helmet());
    app.use(express.json({ limit: '1mb' }));
    app.use(
        cors({
            origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((s) => s.trim()),
        })
    );
    app.use(morgan('dev'));

    if (!serveClient) {
        app.get('/', (req, res) => {
            res.json({ name: 'play-by-play-server', ok: true });
        });
    }

    app.use('/health', healthRoutes({ gameWatcher }));
    app.use('/api', explainRoutes);
    app.use('/api', gameRoutes({ gameWatcher, pollOnRead }));
    app.use('/api', nflRoutes);

    app.get('/api/info', (req, res) => {
        res.json({ name: 'play-by-play-server', ok: true });
    });

    // Optional: serve the built client (for a single-server production-style deploy)
    if (serveClient) {
        const distDir = path.join(__dirname, '..', '..', 'client', 'dist');
        const indexHtml = path.join(distDir, 'index.html');

        if (fs.existsSync(distDir) && fs.existsSync(indexHtml)) {
            app.use(express.static(distDir));
            app.get('*', (req, res) => {
                res.sendFile(indexHtml);
            });
        } else {
            console.warn(
                'SERVE_CLIENT=true but client dist not found. Run: npm --prefix client run build'
            );
        }
    }

    // Basic error handler
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        // Avoid leaking secrets; log server-side.
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    });

    return app;
}

module.exports = { createApp };
