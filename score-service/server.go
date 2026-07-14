// Package main implements a thin HTTP API around the OpenSSF Criticality Score CLI.
// Intended to run in Docker and be called from a trusted backend (e.g. Next.js BFF),
// not directly from untrusted browsers.
package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

const (
	defaultPort           = "8080"
	defaultMaxConcurrency = 2
	commandTimeout        = 90 * time.Second
	cliBinary             = "criticality_score"
	authHeaderPrefix      = "Bearer "
)

// scoreRequest is the JSON body for POST /score.
type scoreRequest struct {
	RepoURL string `json:"repoUrl"`
}

// scoreResponse is the JSON body returned by POST /score.
// code is the CLI exit code (0 on success). When the process fails to start
// or times out, code is -1 and details appear in stderr.
type scoreResponse struct {
	Code   int    `json:"code"`
	Stdout string `json:"stdout"`
	Stderr string `json:"stderr"`
}

// errorResponse is used for request-validation and auth failures.
type errorResponse struct {
	Error string `json:"error"`
}

func main() {
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
	mux.HandleFunc("GET /health", healthHandler)
	mux.HandleFunc("POST /score", scoreHandler(token, slots))

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		// WriteTimeout must exceed commandTimeout so long CLI runs can finish.
		WriteTimeout: 100 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown on SIGINT/SIGTERM.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Printf("score-service listening on %s (max concurrency=%d)", srv.Addr, maxConc)
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

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

func scoreHandler(serviceToken string, slots chan struct{}) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !authorize(r, serviceToken) {
			writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "unauthorized"})
			return
		}

		// Bound body size to avoid abuse.
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB

		repoURL, err := parseScoreRequest(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: err.Error()})
			return
		}

		// Non-blocking acquire: reject when saturated instead of queueing forever.
		select {
		case slots <- struct{}{}:
			defer func() { <-slots }()
		default:
			writeJSON(w, http.StatusServiceUnavailable, errorResponse{
				Error: "server busy: too many concurrent score requests",
			})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), commandTimeout)
		defer cancel()

		resp, httpStatus := runCriticalityScore(ctx, repoURL)
		writeJSON(w, httpStatus, resp)
	}
}

// authorize checks Bearer SCORE_SERVICE_TOKEN when configured.
// If serviceToken is empty, auth is skipped (local development only).
func authorize(r *http.Request, serviceToken string) bool {
	if serviceToken == "" {
		return true
	}
	h := r.Header.Get("Authorization")
	if !strings.HasPrefix(h, authHeaderPrefix) {
		return false
	}
	got := strings.TrimPrefix(h, authHeaderPrefix)
	// Constant-time compare for the shared BFF secret.
	return subtle.ConstantTimeCompare([]byte(got), []byte(serviceToken)) == 1
}

// parseScoreRequest decodes JSON and validates/canonicalizes the GitHub repo URL.
func parseScoreRequest(r *http.Request) (string, error) {
	var req scoreRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		return "", errors.New("invalid JSON body")
	}

	repoURL := strings.TrimSpace(req.RepoURL)
	if repoURL == "" {
		return "", errors.New("repoUrl is required")
	}

	canonical, err := canonicalizeGitHubRepoURL(repoURL)
	if err != nil {
		return "", err
	}
	return canonical, nil
}

// canonicalizeGitHubRepoURL accepts only https://github.com/owner/repo and
// returns a normalized form without userinfo, query, fragment, or extra path.
func canonicalizeGitHubRepoURL(raw string) (string, error) {
	const errMsg = "repoUrl must be a GitHub URL like https://github.com/owner/repo"

	u, err := url.Parse(raw)
	if err != nil {
		return "", errors.New(errMsg)
	}
	if u.Scheme != "https" {
		return "", errors.New(errMsg)
	}
	host := strings.ToLower(u.Hostname())
	if host == "www.github.com" {
		host = "github.com"
	}
	if host != "github.com" {
		return "", errors.New(errMsg)
	}
	if u.User != nil {
		return "", errors.New(errMsg)
	}
	if u.RawQuery != "" || u.Fragment != "" {
		return "", errors.New(errMsg)
	}

	path := strings.Trim(u.Path, "/")
	path = strings.TrimSuffix(path, ".git")
	parts := strings.Split(path, "/")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", errors.New(errMsg)
	}
	// Keep owner/repo conservative: no nested paths (e.g. tree/main).
	owner, repo := parts[0], parts[1]
	if strings.ContainsAny(owner, " \t") || strings.ContainsAny(repo, " \t") {
		return "", errors.New(errMsg)
	}

	return "https://github.com/" + owner + "/" + repo, nil
}

// runCriticalityScore executes the CLI with an argv array (never a shell).
// Returns a scoreResponse and the HTTP status to send to the client.
func runCriticalityScore(ctx context.Context, repoURL string) (scoreResponse, int) {
	cmd := exec.CommandContext(ctx, cliBinary, "-depsdev-disable", repoURL)

	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	resp := scoreResponse{
		Stdout: stdout.String(),
		Stderr: stderr.String(),
	}

	if err == nil {
		resp.Code = 0
		return resp, http.StatusOK
	}

	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		resp.Code = -1
		resp.Stderr = appendLine(resp.Stderr, "error: command timed out after 90s")
		return resp, http.StatusGatewayTimeout
	}

	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		resp.Code = exitErr.ExitCode()
		// CLI ran; client inspects code/stdout/stderr.
		return resp, http.StatusOK
	}

	resp.Code = -1
	resp.Stderr = appendLine(resp.Stderr, "error: "+err.Error())
	return resp, http.StatusInternalServerError
}

func appendLine(existing, line string) string {
	if existing == "" {
		return line
	}
	return existing + "\n" + line
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(true)
	if err := enc.Encode(v); err != nil {
		log.Printf("failed to write JSON response: %v", err)
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
