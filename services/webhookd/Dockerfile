FROM denoland/deno:2.1.4
WORKDIR /app
COPY deno.json mod.ts ./
COPY src ./src
RUN deno cache mod.ts && mkdir -p .local
CMD ["deno", "task", "start"]
