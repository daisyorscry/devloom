FROM node:24-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends procps ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.server.json vite.config.ts index.html ./
COPY src ./src
COPY server ./server
COPY public ./public
COPY tests ./tests
COPY examples ./examples
RUN npm test && npm run build && npm prune --omit=dev

FROM base AS runtime
LABEL org.opencontainers.image.licenses="MIT"
WORKDIR /app
ENV NODE_ENV=production \
    DEVLOOM_HOST=0.0.0.0 \
    DEVLOOM_PORT=4310 \
    DEVLOOM_OTLP_PORT=4318 \
    DEVLOOM_DATA_DIR=/data
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server/proto ./server/proto
COPY --chown=node:node examples ./examples
COPY --chown=node:node LICENSE ./LICENSE
RUN mkdir -p /data /workspace && chown node:node /data /workspace
USER node
EXPOSE 4310 4318
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e 'const e=process.env;const headers=e.DEVLOOM_AUTH_USERNAME?{Authorization:"Basic "+Buffer.from(e.DEVLOOM_AUTH_USERNAME+":"+e.DEVLOOM_AUTH_PASSWORD).toString("base64")}:{};Promise.all([fetch("http://127.0.0.1:"+e.DEVLOOM_PORT+"/api/session",{headers}),fetch("http://127.0.0.1:"+e.DEVLOOM_OTLP_PORT+"/health")]).then(rs=>process.exit(rs.every(r=>r.ok)?0:1)).catch(()=>process.exit(1))'
CMD ["node", "dist/server/server/index.js"]
