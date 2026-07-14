# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Stage 1: install OpenSSF Criticality Score CLI
# -----------------------------------------------------------------------------
FROM golang:1.24-alpine AS cli

ARG TARGETARCH

RUN apk add --no-cache git ca-certificates

# Install the pinned CLI version into /out (match runtime TARGETARCH).
RUN GOBIN=/out CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} \
    go install github.com/ossf/criticality_score/v2/cmd/criticality_score@v2.0.4

# -----------------------------------------------------------------------------
# Stage 2: build the HTTP server
# -----------------------------------------------------------------------------
FROM golang:1.24-alpine AS server

ARG TARGETARCH

WORKDIR /src

# Cache module downloads when go.mod changes less often than source.
# Stdlib-only service: no go.sum required.
COPY go.mod ./
RUN go mod download

COPY server.go ./

RUN CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w" -o /out/server server.go

# -----------------------------------------------------------------------------
# Stage 3: minimal runtime image
# -----------------------------------------------------------------------------
FROM alpine:3.21

RUN apk add --no-cache ca-certificates wget \
    && adduser -D -H -u 10001 appuser

# HTTP server + Criticality Score CLI
COPY --from=server /out/server /usr/local/bin/server
COPY --from=cli /out/criticality_score /usr/local/bin/criticality_score

USER appuser

ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["/usr/local/bin/server"]
