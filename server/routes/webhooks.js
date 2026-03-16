const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { addWebhookJob } = require('../services/queue');
const orchestrator = require('../services/callOrchestrator');
const logger = require('../utils/logger');
const { webhookLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * POST /api/v1/webhooks/bolna — Receive call status updates from Bolna AI
 *
 * Returns 200 immediately and pushes processing to the webhook job queue
 * so Bolna never times out waiting for our response.
 * Idempotent: duplicate delivery of the same execution_id is a no-op.
 */
router.post('/bolna', webhookLimiter, async (req, res) => {
    // Always ACK immediately — Bolna retries on non-200
    res.status(200).json({ received: true });

    const payload = req.body;
    const executionId = payload.execution_id || payload.id;

    if (!executionId) {
        logger.warn('[Webhook] Missing execution_id in payload', { correlationId: req.correlationId });
        return;
    }

    // Idempotency check — drop duplicate webhook deliveries
    if (db.isWebhookProcessed(executionId)) {
        logger.debug('[Webhook] Duplicate webhook ignored', { executionId });
        return;
    }

    logger.info('[Webhook] Bolna event received', {
        executionId,
        status: payload.status || payload.call_status,
        correlationId: req.correlationId,
    });

    // Offload to queue worker so this handler stays non-blocking
    try {
        await addWebhookJob(payload);
    } catch (err) {
        logger.error('[Webhook] Failed to enqueue webhook job', { executionId, error: err.message });
    }
});

/**
 * processWebhook — called by the BullMQ webhook worker.
 * Exported so server.js can wire it into startWorkers().
 */
async function processWebhook(payload) {
    const executionId = payload.execution_id || payload.id;

    // Re-check inside the worker (job may have been retried)
    if (db.isWebhookProcessed(executionId)) {
        logger.debug('[Webhook] Worker: duplicate skipped', { executionId });
        return;
    }

    const status = payload.status || payload.call_status;
    const transcript = payload.transcript || payload.conversation || [];
    const duration = payload.duration || payload.call_duration || 0;
    const extractedData = payload.extracted_data || payload.variables || {};
    const recordingUrl = payload.recording_url || payload.recording || null;

    const contact = db.getContactByExecutionId(executionId);

    if (!contact) {
        logger.warn('[Webhook] No contact found for execution', { executionId });
        db.markWebhookProcessed(executionId, `no_contact_${status}`);
        return;
    }

    switch (status) {
        case 'in-progress':
        case 'in_progress':
        case 'ringing':
            db.updateContact(contact.id, {
                status: 'in-progress',
                bolna_execution_id: executionId,
            });
            db.insertCallLog({
                id: uuidv4(),
                campaignId: contact.campaign_id,
                contactId: contact.id,
                eventType: 'call_in_progress',
                eventData: payload,
            });
            db.updateCampaignStats(contact.campaign_id);
            break;

        case 'completed':
        case 'ended':
        case 'done':
            await orchestrator.handleCallCompleted(contact.id, {
                transcript,
                duration,
                extracted_data: extractedData,
                recording_url: recordingUrl,
                raw: payload,
            });
            break;

        case 'failed':
        case 'error':
        case 'no-answer':
        case 'busy':
            db.updateContact(contact.id, {
                status: 'failed',
                call_outcome: status,
                call_ended_at: new Date().toISOString(),
                notes: payload.error || payload.reason || `Call ${status}`,
            });
            db.insertCallLog({
                id: uuidv4(),
                campaignId: contact.campaign_id,
                contactId: contact.id,
                eventType: `call_${status}`,
                eventData: payload,
            });
            db.updateCampaignStats(contact.campaign_id);
            break;

        default:
            logger.info('[Webhook] Unknown status', { status, executionId });
            db.insertCallLog({
                id: uuidv4(),
                campaignId: contact.campaign_id,
                contactId: contact.id,
                eventType: `webhook_${status || 'unknown'}`,
                eventData: payload,
            });
    }

    db.markWebhookProcessed(executionId, status);
    logger.info('[Webhook] Processed', { executionId, status, contactId: contact.id });
}

module.exports = router;
module.exports.processWebhook = processWebhook;
