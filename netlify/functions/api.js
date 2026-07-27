const serverless = require('serverless-http');

const { createApp } = require('../../server/src/app');
const { createGameWatcher } = require('../../server/src/services/gameWatcher');

// Netlify may reuse a warm function instance, so preserve cached games and
// explanations when possible. Routes still refresh on every read so a cold
// start never depends on an earlier /watch request.
const gameWatcher = createGameWatcher();
const app = createApp({ gameWatcher, pollOnRead: true });

module.exports.handler = serverless(app);
