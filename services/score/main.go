// Command score is a thin HTTP API around the OpenSSF Criticality Score CLI.
// Intended to run in Docker and be called from a trusted backend (e.g. Next.js BFF),
// not directly from untrusted browsers.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/zhyd1997/oss-criticality-radar/services/score/internal/api"
	"github.com/zhyd1997/oss-criticality-radar/services/score/internal/cli"
)

const (
	defaultPort           = "8080"
	defaultMaxConcurrency = 2
)

func main() {
	resolved, err := exec.LookPath(cli.BinaryName)
	if err != nil {
		log.Fatalf("criticality_score not found in PATH: %v", err)
	}
	cli.Path = resolved

	port := envOr("PORT", defaultPort)
	token := strings.TrimSpace(os.Getenv("SCORE_SERVICE_TOKEN"))
	maxConc := envIntOr("SCORE_MAX_CONCURRENCY", defaultMaxConcurrency)
	if maxConc < 1 {
		maxConc = 1
	}

	if strings.TrimSpace(os.Getenv("GITHUB_AUTH_TOKEN")) == "" {
		log.Printf("warning: GITHUB_AUTH_TOKEN is unset; criticality_score will fail or hit strict rate limits")
	}
	if token == "" {
		log.Printf("warning: SCORE_SERVICE_TOKEN is unset; POST /score is unauthenticated (local dev only)")
	}

	// Limit concurrent CLI processes to avoid host DoS / OOM.
	slots := make(chan struct{}, maxConc)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", api.HealthHandler)
	mux.HandleFunc("POST /score", api.ScoreHandler(token, slots))

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		// WriteTimeout must exceed cli.Timeout so long CLI runs can finish.
		WriteTimeout: 100 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown on SIGINT/SIGTERM.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Printf("score service listening on %s (max concurrency=%d, cli=%s)", srv.Addr, maxConc, cli.Path)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server failed: %v", err)
		}
	}()

	<-ctx.Done()
	log.Printf("shutdown signal received")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envIntOr(key string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	n := 0
	for _, c := range v {
		if c < '0' || c > '9' {
			return fallback
		}
		n = n*10 + int(c-'0')
	}
	return n
}
