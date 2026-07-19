FROM node:22.19.0-bookworm-slim AS build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY frontend/package.json frontend/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/design-tokens/package.json packages/design-tokens/package.json
COPY apps/agent-worker/package.json apps/agent-worker/package.json
COPY packages/agent-runtime/package.json packages/agent-runtime/package.json

RUN corepack pnpm install --frozen-lockfile

COPY frontend frontend
COPY packages/contracts packages/contracts
COPY packages/design-tokens packages/design-tokens

ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack pnpm --filter @scrollstack/contracts build \
    && corepack pnpm --filter @scrollstack/frontend build

FROM node:22.19.0-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

COPY --from=build --chown=node:node /app /app

USER node
EXPOSE 3000
CMD ["corepack", "pnpm", "--filter", "@scrollstack/frontend", "start"]
