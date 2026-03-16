const express = require('express');
const db = require('../db/database');
const bolnaService = require('../services/bolnaService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/calls/:contactId — Get call details for a contact
 */
router.get('/:contactId', (req, res) => {
    try {
        const contact = db.getContact(req.params.contactId);
        if (!contact) {
            return res.status(404).json({ success: false, error: 'Contact not found' });
        }

        const logs = db.getCallLogs(req.params.contactId);

        res.json({
            success: true,
            data: {
                contact,
                logs,
                transcript: contact.transcript_json ? JSON.parse(contact.transcript_json) : [],
            },
        });
    } catch (error) {
        logger.error('[Calls] Get error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/calls/:contactId/transcript — Get call transcript
 */
router.get('/:contactId/transcript', async (req, res) => {
    try {
        const contact = db.getContact(req.params.contactId);
        if (!contact) {
            return res.status(404).json({ success: false, error: 'Contact not found' });
        }

        // If we have stored transcript, return it
        if (contact.transcript_json) {
            return res.json({
                success: true,
                data: JSON.parse(contact.transcript_json),
            });
        }

        // Otherwise try to fetch from Bolna
        if (contact.bolna_execution_id) {
            const result = await bolnaService.getExecution(contact.bolna_execution_id);
            if (result.success) {
                // Store for future use
                db.updateContact(req.params.contactId, {
                    transcript_json: JSON.stringify(result.data.transcript || result.data.conversation || []),
                });
                return res.json({
                    success: true,
                    data: result.data.transcript || result.data.conversation || [],
                });
            }
        }

        res.json({ success: true, data: [] });
    } catch (error) {
        logger.error('[Calls] Transcript error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/calls/:contactId/stop — Stop an active call
 */
router.post('/:contactId/stop', async (req, res) => {
    try {
        const contact = db.getContact(req.params.contactId);
        if (!contact) {
            return res.status(404).json({ success: false, error: 'Contact not found' });
        }

        if (contact.call_id) {
            await bolnaService.stopCall(contact.call_id);
        }

        db.updateContact(req.params.contactId, {
            status: 'completed',
            call_outcome: 'manually_stopped',
            call_ended_at: new Date().toISOString(),
        });

        db.updateCampaignStats(contact.campaign_id);

        res.json({ success: true, message: 'Call stopped' });
    } catch (error) {
        logger.error('[Calls] Stop error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
