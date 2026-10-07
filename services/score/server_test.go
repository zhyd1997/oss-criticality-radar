package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"strings"
	"testing"
	"time"
)

func TestCanonicalizeGitHubRepoURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		in      string
		want    string
		wantErr bool
	}{
		{
			name: "valid",
			in:   "https://github.com/softmaple/softmaple",
			want: "https://github.com/softmaple/softmaple",
		},
		{
			name: "trim .git",
			in:   "https://github.com/softmaple/softmaple.git",
			want: "https://github.com/softmaple/softmaple",
		},
		{
			name: "www host",
			in:   "https://www.github.com/softmaple/softmaple",
			want: "https://github.com/softmaple/softmaple",
		},
		{
			name:    "empty",
			in:      "",
			wantErr: true,
		},
		{
			name:    "non-github",
			in:      "https://gitlab.com/o/r",
			wantErr: true,
		},
		{
			name:    "http scheme",
			in:      "http://github.com/o/r",
			wantErr: true,
		},
		{
			name:    "missing repo",
			in:      "https://github.com/only-owner",
			wantErr: true,
		},
		{
			name:    "extra path",
			in:      "https://github.com/o/r/tree/main",
			wantErr: true,
		},
		{
			name:    "query rejected",
			in:      "https://github.com/o/r?x=1",
			wantErr: true,
		},
		{
			name:    "fragment rejected",
			in:      "https://github.com/o/r#frag",
			wantErr: true,
		},
		{
			name:    "userinfo rejected",
			in:      "https://user:pass@github.com/o/r",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := canonicalizeGitHubRepoURL(tt.in)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got %q", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestScoreHandler_Validation(t *testing.T) {
	slots := make(chan struct{}, 2)
	h := scoreHandler("", slots)

	t.Run("missing repoUrl", func(t *testing.T) {
		rr := postScore(t, h, `{}`, "")
		if rr.Code != http.StatusBadRequest {
			t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
		}
		if !strings.Contains(rr.Body.String(), "repoUrl is required") {
			t.Fatalf("body=%s", rr.Body.String())
		}
	})

	t.Run("invalid host", func(t *testing.T) {
		rr := postScore(t, h, `{"repoUrl":"https://evil.com/o/r"}`, "")
		if rr.Code != http.StatusBadRequest {
			t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
		}
	})

	t.Run("invalid json", func(t *testing.T) {
		rr := postScore(t, h, `{`, "")
		if rr.Code != http.StatusBadRequest {
			t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
		}
	})
}

func TestScoreHandler_Auth(t *testing.T) {
	slots := make(chan struct{}, 2)
	h := scoreHandler("secret-token", slots)

	t.Run("missing bearer", func(t *testing.T) {
		rr := postScore(t, h, `{"repoUrl":"https://github.com/o/r"}`, "")
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
		}
	})

	t.Run("wrong bearer", func(t *testing.T) {
		rr := postScore(t, h, `{"repoUrl":"https://github.com/o/r"}`, "Bearer wrong")
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
		}
	})

	t.Run("valid bearer reaches handler past auth", func(t *testing.T) {
		// Deterministic success: ignore real CLI; exit 0 with empty stdout.
		restoreCommandContext(t, func(ctx context.Context, name string, arg ...string) *exec.Cmd {
			return exec.CommandContext(ctx, "true")
		})

		rr := postScore(t, h, `{"repoUrl":"https://github.com/o/r"}`, "Bearer secret-token")
		if rr.Code != http.StatusOK {
			t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
		}
		var resp scoreResponse
		if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
			t.Fatalf("json: %v body=%s", err, rr.Body.String())
		}
		if resp.Code != 0 {
			t.Fatalf("code=%d body=%s", resp.Code, rr.Body.String())
		}
	})
}

func TestRunCriticalityScore_ExitCode(t *testing.T) {
	restoreCommandContext(t, func(ctx context.Context, name string, arg ...string) *exec.Cmd {
		// false exits 1 on POSIX.
		return exec.CommandContext(ctx, "false")
	})

	resp, status := runCriticalityScore(context.Background(), "https://github.com/o/r")
	if status != http.StatusOK {
		t.Fatalf("status=%d", status)
	}
	if resp.Code != 1 {
		t.Fatalf("code=%d stderr=%q", resp.Code, resp.Stderr)
	}
}

func TestRunCriticalityScore_Success(t *testing.T) {
	restoreCommandContext(t, func(ctx context.Context, name string, arg ...string) *exec.Cmd {
		return exec.CommandContext(ctx, "true")
	})

	resp, status := runCriticalityScore(context.Background(), "https://github.com/o/r")
	if status != http.StatusOK || resp.Code != 0 {
		t.Fatalf("status=%d code=%d stderr=%q", status, resp.Code, resp.Stderr)
	}
}

func TestRunCriticalityScore_Timeout(t *testing.T) {
	restoreCommandContext(t, func(ctx context.Context, name string, arg ...string) *exec.Cmd {
		return exec.CommandContext(ctx, "sleep", "30")
	})

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	start := time.Now()
	resp, status := runCriticalityScore(ctx, "https://github.com/o/r")
	elapsed := time.Since(start)

	if status != http.StatusGatewayTimeout {
		t.Fatalf("status=%d body code=%d stderr=%q", status, resp.Code, resp.Stderr)
	}
	if resp.Code != -1 {
		t.Fatalf("code=%d", resp.Code)
	}
	if !strings.Contains(resp.Stderr, "timed out") {
		t.Fatalf("stderr=%q", resp.Stderr)
	}
	// Should return promptly (well under sleep 30), allowing for WaitDelay.
	if elapsed > 5*time.Second {
		t.Fatalf("timeout path too slow: %v", elapsed)
	}
}

func TestHealthHandler(t *testing.T) {
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	healthHandler(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d", rr.Code)
	}
	if rr.Body.String() != "ok" {
		t.Fatalf("body=%q", rr.Body.String())
	}
}

func postScore(t *testing.T, h http.HandlerFunc, body, auth string) *httptest.ResponseRecorder {
	t.Helper()
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/score", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	h(rr, req)
	return rr
}

func restoreCommandContext(t *testing.T, fn func(ctx context.Context, name string, arg ...string) *exec.Cmd) {
	t.Helper()
	prev := commandContext
	commandContext = fn
	t.Cleanup(func() { commandContext = prev })
}

func TestAppendLine(t *testing.T) {
	if got := appendLine("", "a"); got != "a" {
		t.Fatalf("got %q", got)
	}
	if got := appendLine("a", "b"); got != "a\nb" {
		t.Fatalf("got %q", got)
	}
}

// Ensure scoreResponse JSON shape stays stable for API clients.
func TestScoreResponseJSONShape(t *testing.T) {
	b, err := json.Marshal(scoreResponse{Code: 0, Stdout: "out", Stderr: "err"})
	if err != nil {
		t.Fatal(err)
	}
	s := string(b)
	for _, key := range []string{`"code"`, `"stdout"`, `"stderr"`} {
		if !strings.Contains(s, key) {
			t.Fatalf("missing %s in %s", key, s)
		}
	}
}
