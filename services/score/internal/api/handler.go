// Package api implements the HTTP handlers for the score service.
// Intended to be called from a trusted backend (e.g. Next.js BFF),
// not directly from untrusted browsers.
package api

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/zhyd1997/oss-criticality-radar/services/score/internal/cli"
)

const authHeaderPrefix = "Bearer "

// scoreRequest is the JSON body for POST /score.
type scoreRequest struct {
	RepoURL string `json:"repoUrl"`
}

// errorResponse is used for request-validation and auth failures.
type errorResponse struct {
	Error string `json:"error"`
}

// HealthHandler serves GET /health.
func HealthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

// ScoreHandler serves POST /score. slots bounds concurrent CLI processes.
func ScoreHandler(serviceToken string, slots chan struct{}) http.HandlerFunc {
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

		ctx, cancel := context.WithTimeout(r.Context(), cli.Timeout)
		defer cancel()

		resp, httpStatus := cli.Run(ctx, repoURL)
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
	// Exactly one JSON object: reject trailing values such as a second object.
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
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

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(true)
	if err := enc.Encode(v); err != nil {
		log.Printf("failed to write JSON response: %v", err)
	}
}
