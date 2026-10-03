FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY . .

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["bun", "server/index.ts"]
