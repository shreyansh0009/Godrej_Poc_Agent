const rateLimit = require('express-rate-limit');

const defaultLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later.' },
});

// Tighter limit for campaign start — prevents accidental storm
const campaignStartLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many campaign start requests.' },
});

// Relaxed limit for webhooks — Bolna can send bursts
const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Webhook rate limit exceeded.' },
});

module.exports = { defaultLimiter, campaignStartLimiter, webhookLimiter };
