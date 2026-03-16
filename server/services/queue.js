const { Queue, Worker, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

// ─── Redis Connection ─────────────────────────────────────────

const redisConnection = new IORedis(config.redis.url, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
});

redisConnection.on('connect', () => logger.info('[Queue] Redis connected'));
redisConnection.on('error', (err) => logger.error('[Queue] Redis error', { error: err.message }));

// ─── Queue Definitions ────────────────────────────────────────

const callQueue = new Queue('voice-calls', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100, age: config.queue.jobTtl / 1000 },
        removeOnFail: { count: 200, age: config.queue.jobTtl / 1000 * 2 },
    },
});

const webhookQueue = new Queue('webhooks', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
    },
});

// ─── Queue Helpers ────────────────────────────────────────────

async function addCallJob(contactId, campaignId, delayMs = 0) {
    return callQueue.add(
        'initiate-call',
        { contactId, campaignId },
        { delay: delayMs, jobId: `call-${contactId}` }
    );
}

async function addWebhookJob(payload) {
    const executionId = payload.execution_id || payload.id || `hook-${Date.now()}`;
    return webhookQueue.add(
        'process-webhook',
        payload,
        { jobId: `webhook-${executionId}` }
    );
}

async function getQueueDepth() {
    const [callWaiting, callActive, webhookWaiting, webhookActive] = await Promise.all([
        callQueue.getWaitingCount(),
        callQueue.getActiveCount(),
        webhookQueue.getWaitingCount(),
        webhookQueue.getActiveCount(),
    ]);
    return { callWaiting, callActive, webhookWaiting, webhookActive };
}

// ─── Worker Factory ───────────────────────────────────────────

let callWorker = null;
let webhookWorker = null;

/**
 * Start workers. Called from server.js after all services are ready.
 * Accepts processor functions injected from outside to avoid circular deps.
 *
 * @param {Function} processCall  - async (contactId, campaignId) => void
 * @param {Function} processWebhook - async (payload) => void
 */
function startWorkers(processCall, processWebhook) {
    callWorker = new Worker(
        'voice-calls',
        async (job) => {
            const { contactId, campaignId } = job.data;
            logger.info('[Queue] Processing call job', { jobId: job.id, contactId, campaignId });
            await processCall(contactId, campaignId);
        },
        {
            connection: redisConnection,
            concurrency: config.queue.concurrency,
        }
    );

    callWorker.on('completed', (job) => {
        logger.info('[Queue] Call job completed', { jobId: job.id });
    });

    callWorker.on('failed', (job, err) => {
        logger.error('[Queue] Call job failed', { jobId: job?.id, error: err.message, attempts: job?.attemptsMade });
    });

    callWorker.on('error', (err) => {
        logger.error('[Queue] Call worker error', { error: err.message });
    });

    webhookWorker = new Worker(
        'webhooks',
        async (job) => {
            logger.info('[Queue] Processing webhook job', { jobId: job.id });
            await processWebhook(job.data);
        },
        {
            connection: redisConnection,
            concurrency: 10,
        }
    );

    webhookWorker.on('completed', (job) => {
        logger.debug('[Queue] Webhook job completed', { jobId: job.id });
    });

    webhookWorker.on('failed', (job, err) => {
        logger.error('[Queue] Webhook job failed', { jobId: job?.id, error: err.message });
    });

    webhookWorker.on('error', (err) => {
        logger.error('[Queue] Webhook worker error', { error: err.message });
    });

    logger.info('[Queue] Workers started', { callConcurrency: config.queue.concurrency, webhookConcurrency: 10 });
}

async function closeQueues() {
    await Promise.all([
        callWorker?.close(),
        webhookWorker?.close(),
        callQueue.close(),
        webhookQueue.close(),
        redisConnection.quit(),
    ]);
    logger.info('[Queue] All queues and workers closed');
}

module.exports = {
    callQueue,
    webhookQueue,
    redisConnection,
    addCallJob,
    addWebhookJob,
    getQueueDepth,
    startWorkers,
    closeQueues,
};
