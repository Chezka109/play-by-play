const express = require('express');
const crypto = require('crypto');

const { parsePlayText } = require('../parsers/playParser');
const { explanationService } = require('../services/explanationService');

const router = express.Router();

router.post('/explain-play', async (req, res, next) => {
    try {
        const {
            text,
            play,
            recentPlays,
            game,
            audience,
            sessionId,
            force,
        } = req.body || {};
        const playInput = play || (text ? { text } : null);

        if (!playInput?.text || typeof playInput.text !== 'string') {
            return res.status(400).json({ error: 'Missing required play text' });
        }

        const safetyIdentifier = sessionId
            ? crypto.createHash('sha256').update(String(sessionId)).digest('hex').slice(0, 64)
            : null;
        const explanation = await explanationService.explain(
            {
                play: playInput,
                recentPlays,
                game,
                audience,
                safetyIdentifier,
            },
            { force: force === true }
        );
        res.json({ playId: playInput.id || null, explanation });
    } catch (err) {
        next(err);
    }
});

router.post('/parse-play', (req, res) => {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Missing required field: text' });
    }
    res.json({ text, parsed: parsePlayText(text) });
});

module.exports = router;
