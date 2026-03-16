const express = require('express');
const agentSquads = require('../services/agentSquads');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/agents/squads — Get all squad agent definitions
 */
router.get('/squads', (req, res) => {
    try {
        const squads = agentSquads.getSquadPrompts();
        res.json({ success: true, data: squads });
    } catch (error) {
        logger.error('[Agents] Get squads error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/agents/squads/:squadName — Get a specific squad agent
 */
router.get('/squads/:squadName', (req, res) => {
    try {
        const squads = agentSquads.getSquadPrompts();
        const squad = squads[req.params.squadName];

        if (!squad) {
            return res.status(404).json({ success: false, error: 'Squad agent not found' });
        }

        res.json({ success: true, data: squad });
    } catch (error) {
        logger.error('[Agents] Get squad error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/agents/preview-prompt — Preview the full agent prompt with variables
 */
router.post('/preview-prompt', (req, res) => {
    try {
        const variables = req.body;
        const prompt = agentSquads.buildUnifiedPrompt(variables);
        const welcomeMessage = agentSquads.buildWelcomeMessage(variables);

        res.json({
            success: true,
            data: {
                prompt,
                welcomeMessage,
            },
        });
    } catch (error) {
        logger.error('[Agents] Preview prompt error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
