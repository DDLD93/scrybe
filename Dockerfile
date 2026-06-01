FROM node:26-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    curl \
    unzip \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
    -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
  && rm -rf /var/lib/apt/lists/* \
  && yt-dlp --version \
  && ffmpeg -version | head -1 \
  && deno --version

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV HOST=0.0.0.0
ENV PORT=3000
ENV YTDLP_PATH=yt-dlp
ENV FFMPEG_PATH=ffmpeg
ENV FFPROBE_PATH=ffprobe
ENV PATH="/usr/local/bin:${PATH}"

EXPOSE 3000

CMD ["npm", "start"]
