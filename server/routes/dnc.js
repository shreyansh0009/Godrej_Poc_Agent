const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db/database');
const logger = require('../utils/logger');

const router = express.Router();

function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
}

/**
 * GET /api/v1/dnc — List all DNC numbers
 */
router.get('/', (_req, res) => {
    try {
        const list = db.getDNCList();
        res.json({ success: true, data: list, total: list.length });
    } catch (error) {
        logger.error('[DNC] List error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/dnc — Add a single number to DNC
 * Body: { phone_number, reason? }
 */
router.post('/',
    body('phone_number').trim().notEmpty().withMessage('phone_number is required'),
    body('reason').optional().trim().isLength({ max: 500 }),
    validate,
    (req, res) => {
        try {
            const { phone_number, reason } = req.body;
            db.addToDNC(phone_number, reason);
            logger.info('[DNC] Number added', { phone: phone_number });
            res.json({ success: true, message: 'Number added to DNC list' });
        } catch (error) {
            logger.error('[DNC] Add error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

/**
 * POST /api/v1/dnc/bulk — Bulk add numbers to DNC
 * Body: [{ phone_number, reason? }, ...]
 */
router.post('/bulk',
    body().isArray({ min: 1 }).withMessage('Body must be a non-empty array'),
    body('*.phone_number').trim().notEmpty().withMessage('Each entry must have phone_number'),
    validate,
    (req, res) => {
        try {
            const entries = req.body;
            db.bulkAddToDNC(entries);
            logger.info('[DNC] Bulk added', { count: entries.length });
            res.json({ success: true, message: `${entries.length} number(s) added to DNC list` });
        } catch (error) {
            logger.error('[DNC] Bulk add error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

/**
 * DELETE /api/v1/dnc/:phone — Remove a number from DNC
 */
router.delete('/:phone',
    param('phone').trim().notEmpty(),
    validate,
    (req, res) => {
        try {
            db.removeFromDNC(decodeURIComponent(req.params.phone));
            logger.info('[DNC] Number removed', { phone: req.params.phone });
            res.json({ success: true, message: 'Number removed from DNC list' });
        } catch (error) {
            logger.error('[DNC] Remove error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

module.exports = router;
