const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const { Server: SocketServer } = require('socket.io');
const path = require('path');
const config = require('./config');
const db = require('./db/database');
const orchestrator = require('./services/callOrchestrator');
const queue = require('./services/queue');
const { processWebhook } = require('./routes/webhooks');
const logger = require('./utils/logger');
const correlationId = require('./middleware/correlationId');
const { defaultLimiter } = require('./middleware/rateLimiter');

// ─── Initialize Express ───────────────────────────────────────

const app = express();
const server = http.createServer(app);

// ─── Socket.IO ───────────────────────────────────────────────

const io = new SocketServer(server, {
    cors: {
        origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
        methods: ['GET', 'POST'],
    },
});

orchestrator.setSocketIO(io);

io.on('connection', (socket) => {
    logger.debug('[Socket] Client connected', { socketId: socket.id });

    socket.on('join:campaign', (campaignId) => {
        socket.join(`campaign:${campaignId}`);
        logger.debug('[Socket] Joined campaign room', { socketId: socket.id, campaignId });
    });

    socket.on('leave:campaign', (campaignId) => {
        socket.leave(`campaign:${campaignId}`);
    });

    socket.on('disconnect', () => {
        logger.debug('[Socket] Client disconnected', { socketId: socket.id });
    });
});

// ─── Middleware ───────────────────────────────────────────────

// Trust the first proxy (e.g. ngrok, nginx, Bolna webhook relay).
// Required so express-rate-limit can correctly read X-Forwarded-For headers.
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
    crossOriginEmbedderPolicy: false, // Required for Socket.IO
}));

// Correlation ID — must be first so logs carry it
app.use(correlationId);

// CORS
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    credentials: true,
}));

// HTTP request logging via Winston
app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
    skip: (req) => req.path === '/api/v1/health', // skip health-check noise
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limit (per-route limits added in route files)
app.use('/api/', defaultLimiter);

// ─── API Routes (versioned) ───────────────────────────────────

app.use('/api/v1/campaigns', require('./routes/campaigns'));
app.use('/api/v1/calls', require('./routes/calls'));
app.use('/api/v1/webhooks', require('./routes/webhooks'));
app.use('/api/v1/agents', require('./routes/agents'));
app.use('/api/v1/dnc', require('./routes/dnc'));
app.use('/api/v1/test', require('./routes/testAgent'));

// ─── Health Check ─────────────────────────────────────────────

app.get('/api/v1/health', async (_req, res) => {
    try {
        let redisStatus = 'unknown';
        let queueDepth = null;
        try {
            await queue.redisConnection.ping();
            redisStatus = 'connected';
            queueDepth = await queue.getQueueDepth();
        } catch {
            redisStatus = 'disconnected';
        }

        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: '2.0.0',
            services: {
                database: 'connected',
                redis: redisStatus,
                bolna: config.bolna.apiKey ? 'configured' : 'not_configured',
                phone: config.bolna.phoneNumber || 'not_configured',
            },
            queue: queueDepth,
            trai: {
                enforce: config.trai.enforce,
                callWindow: `${config.trai.callWindowStart}:00–${config.trai.callWindowEnd}:00 IST`,
            },
        });
    } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
    }
});

// Legacy health path (backward compat)
app.get('/api/health', (_req, res) => res.redirect('/api/v1/health'));

// ─── Dashboard Stats ──────────────────────────────────────────

app.get('/api/v1/stats', (_req, res) => {
    try {
        const campaigns = db.getAllCampaigns();
        const totalCampaigns = campaigns.length;
        const activeCampaigns = campaigns.filter(c => c.status === 'running').length;
        const totalContacts = campaigns.reduce((sum, c) => sum + (c.total_contacts || 0), 0);

        // Granular contact stats across all campaigns
        const contactStats = db.getDb().prepare(`
            SELECT
                SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status IN ('in-progress', 'dialing') THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN call_outcome = 'request_registered' OR service_request_number IS NOT NULL THEN 1 ELSE 0 END) as booked
            FROM campaign_contacts
        `).get();

        const totalCalls = contactStats.completed || 0;
        const successRate = totalContacts > 0
            ? Math.round((totalCalls / totalContacts) * 100)
            : 0;

        res.json({
            success: true,
            data: {
                totalCampaigns,
                activeCampaigns,
                totalCalls,
                totalContacts,
                successRate,
                pending: contactStats.pending || 0,
                inProgress: contactStats.in_progress || 0,
                failed: contactStats.failed || 0,
                booked: contactStats.booked || 0,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Legacy stats path
app.get('/api/stats', (_req, res) => res.redirect('/api/v1/stats'));

// ─── Error Handler ────────────────────────────────────────────

app.use((err, req, res, _next) => {
    logger.error('[Server] Unhandled error', {
        error: err.message,
        stack: config.nodeEnv === 'development' ? err.stack : undefined,
        correlationId: req.correlationId,
    });
    res.status(err.status || 500).json({
        success: false,
        error: config.nodeEnv === 'development' ? err.message : 'Internal server error',
    });
});

// ─── Startup ──────────────────────────────────────────────────

async function start() {
    // Init database (creates tables + runs migrations)
    db.getDb();
    logger.info('[Server] Database initialised');

    // Ensure uploads directory exists
    const fs = require('fs');
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    // Start BullMQ workers (inject processor functions to avoid circular deps)
    queue.startWorkers(
        (contactId, campaignId) => orchestrator.processCallJob(contactId, campaignId),
        (payload) => processWebhook(payload)
    );
    logger.info('[Server] Queue workers started');

    // Recover any campaigns that were running when server last shut down
    await orchestrator.recoverRunningCampaigns();

    // Start HTTP server
    server.listen(config.port, () => {
        logger.info('[Server] Started', {
            port: config.port,
            env: config.nodeEnv,
            bolnaConfigured: !!config.bolna.apiKey,
            phone: config.bolna.phoneNumber || 'not configured',
            traiEnforced: config.trai.enforce,
            apiBase: '/api/v1',
        });
    });
}

// ─── Graceful Shutdown ────────────────────────────────────────

async function shutdown(signal) {
    logger.info('[Server] Shutdown signal received', { signal });

    // Stop accepting new HTTP connections
    server.close(() => {
        logger.info('[Server] HTTP server closed');
    });

    // Close BullMQ workers and Redis gracefully
    try {
        await queue.closeQueues();
    } catch (err) {
        logger.error('[Server] Error closing queues', { error: err.message });
    }

    // Close SQLite
    try {
        db.getDb().close();
        logger.info('[Server] Database closed');
    } catch (err) {
        logger.error('[Server] Error closing database', { error: err.message });
    }

    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
    logger.error('[Server] Failed to start', { error: err.message, stack: err.stack });
    process.exit(1);
});

module.exports = { app, server, io };
