const express = require('express');

const { parsePlayText } = require('../parsers/playParser');
const { explanationService } = require('../services/explanationService');

const router = express.Router();

router.post('/explain-play', async (req, res, next) => {
    try {
        const { text } = req.body || {};
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Missing required field: text' });
        }

        const explanation = await explanationService.explain(text);
        res.json({ text, explanation });
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
