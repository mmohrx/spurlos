FROM node:26-bookworm-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# the pnpm version CI uses too, from packageManager in package.json
RUN npm install -g "$(node -p "require('./package.json').packageManager.split('+')[0]")"
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json ./
COPY src src
RUN pnpm build && pnpm prune --prod

FROM node:26-bookworm-slim
WORKDIR /app
# Docker's default seccomp profile leaves Chromium no sandbox; the container, run as user node, is the boundary
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright NODE_ENV=production SPURLOS_NO_SANDBOX=1
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules node_modules
# only the headless shell of Chromium, with the system libraries it needs; before the code,
# so this layer stays cached until the dependencies change
RUN node_modules/.bin/playwright install --with-deps chromium-headless-shell \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/dist dist
COPY assets/logo-light.svg assets/logo-dark.svg assets/
USER node
ENTRYPOINT ["node", "dist/cli.js"]
