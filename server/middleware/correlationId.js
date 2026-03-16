const { v4: uuidv4 } = require('uuid');

/**
 * Attaches a correlation ID to every request so log lines can be linked.
 * Honours an incoming X-Correlation-ID header (e.g. from a load balancer).
 */
function correlationId(req, res, next) {
    const id = req.headers['x-correlation-id'] || uuidv4();
    req.correlationId = id;
    res.setHeader('X-Correlation-ID', id);
    next();
}

module.exports = correlationId;
