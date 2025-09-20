# syntax=docker/dockerfile:1

FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY third_party ./third_party
COPY internal ./internal
COPY cmd ./cmd
RUN go build -o worker ./cmd/worker

FROM alpine:3.18
RUN apk add --no-cache ffmpeg ca-certificates
COPY --from=builder /app/worker /usr/local/bin/worker
WORKDIR /app
ENV FFMPEG_BIN=ffmpeg
ENV API_ADDRESS=:8080
EXPOSE 8080
ENTRYPOINT ["worker"]
