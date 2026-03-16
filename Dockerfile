FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY server/ .

# Non-root user for security
RUN addgroup -S voiceagent && adduser -S voiceagent -G voiceagent
RUN chown -R voiceagent:voiceagent /app
USER voiceagent

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

CMD ["node", "server.js"]
