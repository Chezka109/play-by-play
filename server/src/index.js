const { env } = require('./config/env');
const { createApp } = require('./app');
const { createGameWatcher } = require('./services/gameWatcher');

async function main() {
    const gameWatcher = createGameWatcher();

    if (env.defaultEventId) {
        gameWatcher.watch(env.defaultEventId, { pollIntervalMs: env.pollIntervalMs });
    }

    const app = createApp({ gameWatcher });
    const server = app.listen(env.port, () => {
        console.log(`Server listening on http://localhost:${env.port}`);
    });

    function shutdown(signal) {
        console.log(`${signal} received; shutting down`);
        gameWatcher.stopAll();
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(1), 10000).unref();
    }

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));

    server.on('error', (err) => {
        const code = err?.code ? String(err.code) : '';
        if (code === 'EADDRINUSE') {
            console.error(`Port ${env.port} is already in use.`);
        } else {
            console.error('Server error:', err);
        }
        process.exit(1);
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
