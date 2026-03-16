'use strict';

const express = require('express');
const axios = require('axios');
const router = express.Router();
const config = require('../config');
const { buildUnifiedPrompt } = require('../services/agentSquads');
const normalizeTTSText = require('../utils/ttsNormalize');
const logger = require('../utils/logger');

// ─── Shared OpenAI helper ─────────────────────────────────────

async function callOpenAI(systemPrompt, messages, maxTokens = 200) {
    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
            ],
            max_tokens: maxTokens,
            temperature: 0.7,
        },
        {
            headers: {
                Authorization: `Bearer ${config.openai.apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        }
    );
    return response.data.choices[0]?.message?.content?.trim() || '';
}

// ─── POST /api/v1/test/chat ───────────────────────────────────

/**
 * Multi-turn text chat with the agent (no phone call).
 * Body: { messages: [{role, content}], contact: {...} }
 * Returns: { message: string }
 */
router.post('/chat', async (req, res) => {
    if (!config.openai.apiKey) {
        return res.status(503).json({ error: 'OPENAI_API_KEY not configured. Add it to server/.env' });
    }

    const { messages = [], contact = {} } = req.body;
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages must be an array' });

    const systemPrompt = buildUnifiedPrompt(contact);

    try {
        const reply = await callOpenAI(systemPrompt, messages, 200);
        return res.json({ message: reply });
    } catch (err) {
        const status = err.response?.status || 500;
        const errMsg = err.response?.data?.error?.message || err.message;
        logger.error('[TestAgent] /chat error', { status, message: errMsg });
        return res.status(status).json({ error: errMsg });
    }
});

// ─── POST /api/v1/test/speak ──────────────────────────────────

/**
 * Convert agent text to speech via ElevenLabs (for voice testing in browser).
 * Body: { text: string, language: string }
 * Returns: audio/mpeg binary
 */
router.post('/speak', async (req, res) => {
    const { text, language = 'hinglish' } = req.body;

    if (!text) return res.status(400).json({ error: 'text is required' });

    if (!config.elevenlabs.apiKey) {
        return res.status(503).json({ error: 'ELEVENLABS_API_KEY not configured. Add it to server/.env' });
    }

    const voiceId = config.elevenlabs.voiceId || 'broqrJkktxd1CclKTudW'; // fallback: Anika

    // Normalize Roman-script Hindi words to phonetic approximations
    // so ElevenLabs doesn't mispronounce them through its English engine
    const normalizedText = normalizeTTSText(text, language);

    try {
        const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                text: normalizedText,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.7,
                    similarity_boost: 0.55,
                    style: 0.2,
                    speed: 0.99,
                },
            },
            {
                headers: {
                    'xi-api-key': config.elevenlabs.apiKey,
                    'Content-Type': 'application/json',
                    Accept: 'audio/mpeg',
                },
                responseType: 'arraybuffer',
                timeout: 30000,
            }
        );

        res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' });
        return res.send(Buffer.from(response.data));
    } catch (err) {
        const status = err.response?.status || 500;
        logger.error('[TestAgent] /speak error', { status, message: err.message });
        return res.status(status).json({ error: 'TTS generation failed', details: err.message });
    }
});

// ─── POST /api/v1/test/auto-run ───────────────────────────────

/**
 * Automated QA test: an AI customer converses with Naina, then an evaluator
 * analyses the transcript and returns a structured report.
 *
 * Body: { contact: {...}, maxTurns: 15, persona: 'cooperative' }
 * Returns: { conversation, report, meta }
 *
 * Personas: cooperative | busy | hesitant | problematic | hindi_only
 */
router.post('/auto-run', async (req, res) => {
    if (!config.openai.apiKey) {
        return res.status(503).json({ error: 'OPENAI_API_KEY not configured. Add it to server/.env' });
    }

    const { contact = {}, maxTurns = 15, persona = 'cooperative' } = req.body;

    const PERSONA_DESC = {
        cooperative: 'slightly hesitant at first, but agreeable — cooperates after light clarification',
        busy: 'very busy, keeps trying to end the call quickly, but cooperates if the agent is concise',
        hesitant: 'price-sensitive, asks about cost multiple times, needs convincing about why service is needed',
        problematic: 'has complaints about last service, frequently asks off-topic questions',
        hindi_only: 'responds ONLY in pure Hindi (Devanagari script), uses no English words',
    };

    const productLabel = contact.product_name || contact.product_category || contact.vehicle_model || 'Godrej appliance';
    const customerSystemPrompt = `You are roleplaying as ${contact.customer_name || 'Rahul'}, a customer who needs support for a ${productLabel}.
You are speaking with ${contact.dealer_name || 'Godrej Support'}.

Persona: ${PERSONA_DESC[persona] || PERSONA_DESC.cooperative}

Rules (follow strictly):
- Keep ALL responses to 1-2 short sentences — you are on a phone call
- Do NOT volunteer information — only respond to what was just asked
- If asked about the issue: mention the appliance is not working properly
- Ask once about visit timing or complaint status at some natural point
- If asked for model details and not already provided, say you have the model sticker nearby
- Respond in ${contact.preferred_language || 'hinglish'} naturally
- Do NOT use [brackets] for actions — just speak as if on a call`;

    const nainaSystemPrompt = buildUnifiedPrompt(contact);

    const conversation = [];
    const nainaMessages = [];
    const customerMessages = [];

    try {
        // Naina makes the opening call
        const opening = await callOpenAI(nainaSystemPrompt, [], 120);
        conversation.push({ role: 'naina', content: opening });
        nainaMessages.push({ role: 'assistant', content: opening });
        customerMessages.push({ role: 'user', content: opening });

        const limit = Math.min(maxTurns, 25);
        for (let turn = 0; turn < limit; turn++) {
            // Customer responds
            const customerReply = await callOpenAI(customerSystemPrompt, customerMessages, 80);
            conversation.push({ role: 'customer', content: customerReply });
            customerMessages.push({ role: 'assistant', content: customerReply });
            nainaMessages.push({ role: 'user', content: customerReply });

            // Naina responds
            const nainaReply = await callOpenAI(nainaSystemPrompt, nainaMessages, 120);
            conversation.push({ role: 'naina', content: nainaReply });
            nainaMessages.push({ role: 'assistant', content: nainaReply });
            customerMessages.push({ role: 'user', content: nainaReply });

            // End when Naina says goodbye
            if (nainaReply.includes('din shubh ho') || nainaReply.includes('Namaste!')) break;
        }

        // Build transcript for evaluation
        const transcript = conversation
            .map((msg, i) => `[${i + 1}] ${msg.role === 'naina' ? 'Naina (Agent)' : `${contact.customer_name || 'Customer'}`}: ${msg.content}`)
            .join('\n');

        // Evaluate the conversation
        const evalSystemPrompt = `You are a QA expert evaluating Naina, an AI voice agent for Godrej appliance support.
Analyze the conversation transcript and return ONLY valid JSON — no markdown, no code blocks, just raw JSON.

Contact: ${contact.customer_name || 'Customer'}, Product: ${productLabel},
Language: ${contact.preferred_language || 'hinglish'}, Issue: ${contact.issue_summary || 'unknown'}

Expected phases in order:
1. GREETING — Introduce Naina + Godrej Support, lock language, confirm availability
2. VERIFICATION — Confirm identity, role, and contact details
3. DISCOVERY — Understand complaint/service/warranty/product-info need and collect appliance details
4. CASE HANDLING — Explain process, register or escalate if needed, share next steps
5. CLOSING — Recap next step, ask if anything else is needed, close professionally

Return this exact JSON (fill all fields with real analysis):
{
  "criteria": {
    "phase_completion": { "status": "PASS", "score": 8, "observation": "...", "suggestion": "..." },
    "language_consistency": { "status": "PASS", "score": 9, "observation": "...", "suggestion": "..." },
    "feminine_grammar": { "status": "PASS", "score": 9, "observation": "...", "suggestion": "..." },
    "script_adherence": { "status": "PARTIAL", "score": 6, "observation": "...", "suggestion": "..." },
    "guardrail_compliance": { "status": "PASS", "score": 10, "observation": "...", "suggestion": "..." },
    "natural_flow": { "status": "PASS", "score": 7, "observation": "...", "suggestion": "..." },
    "information_accuracy": { "status": "PASS", "score": 8, "observation": "...", "suggestion": "..." },
    "booking_success": { "status": "PASS", "score": 10, "observation": "...", "suggestion": "..." }
  },
  "overall_score": 8.3,
  "gaps": ["Critical gap 1 with example from transcript", "Gap 2", "Gap 3"],
  "strengths": ["Strength 1 with example", "Strength 2"],
  "summary": "2-3 sentence overall assessment of conversation quality and production readiness."
}`;

        const evalRaw = await callOpenAI(evalSystemPrompt, [{ role: 'user', content: transcript }], 1200);

        let report;
        try {
            // Strip any accidental markdown fences
            const cleaned = evalRaw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
            report = JSON.parse(cleaned);
        } catch {
            report = { parse_error: true, raw: evalRaw };
        }

        return res.json({
            conversation,
            report,
            meta: {
                turns: conversation.length,
                persona,
                contact_name: contact.customer_name || 'Unknown',
                language: contact.preferred_language || 'hinglish',
                timestamp: new Date().toISOString(),
            },
        });
    } catch (err) {
        const status = err.response?.status || 500;
        const errMsg = err.response?.data?.error?.message || err.message;
        logger.error('[TestAgent] /auto-run error', { status, message: errMsg });
        return res.status(status).json({ error: errMsg });
    }
});

module.exports = router;
