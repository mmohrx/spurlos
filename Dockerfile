FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@12.4.2
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json ./
COPY src src
RUN pnpm build && pnpm prune --prod

FROM node:24-bookworm-slim
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/dist dist
# only the headless shell of Chromium, with the system libraries it needs
RUN node_modules/.bin/playwright install --with-deps chromium-headless-shell \
 && rm -rf /var/lib/apt/lists/*
USER node
ENTRYPOINT ["node", "dist/cli.js"]
