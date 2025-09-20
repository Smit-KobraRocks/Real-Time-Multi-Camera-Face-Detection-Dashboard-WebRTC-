# syntax=docker/dockerfile:1.6

FROM golang:1.21-alpine AS builder
WORKDIR /app
RUN apk add --no-cache build-base pkgconfig opencv-dev

COPY go.mod ./
COPY third_party ./third_party
COPY internal ./internal
COPY cmd ./cmd

RUN mkdir -p /out
RUN CGO_ENABLED=0 go build -ldflags "-s -w" -o /out/worker ./cmd/worker

FROM alpine:3.19
RUN apk add --no-cache ca-certificates ffmpeg opencv

COPY --from=builder /out/worker /usr/local/bin/worker

WORKDIR /app

RUN addgroup -S worker && adduser -S worker -G worker
RUN chown -R worker:worker /app

ENV FFMPEG_BIN=ffmpeg
ENV API_ADDRESS=:8080

EXPOSE 8080

USER worker

ENTRYPOINT ["worker"]
