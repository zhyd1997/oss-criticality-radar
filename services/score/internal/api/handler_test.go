package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"strings"
	"testing"

	"github.com/zhyd1997/oss-criticality-radar/services/score/internal/cli"
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
		{
			name:    "escaped fragment rejected",
			in:      "https://github.com/o/r%23other",
			wantErr: true,
		},
		{
			name:    "escaped query rejected",
			in:      "https://github.com/o/r%3Fx=1",
			wantErr: true,
		},
		{
			name:    "escaped slash rejected",
			in:      "https://github.com/o%2Fx/r",
			wantErr: true,
		},
		{
			name: "dots, dashes and underscores allowed",
			in:   "https://github.com/my-org/repo_name.js",
			want: "https://github.com/my-org/repo_name.js",
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
	h := ScoreHandler("", slots)

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

	t.Run("trailing json value", func(t *testing.T) {
		rr := postScore(t, h, `{"repoUrl":"https://github.com/o/r"}{"repoUrl":"https://github.com/x/y"}`, "")
		if rr.Code != http.StatusBadRequest {
			t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
		}
	})
}

func TestScoreHandler_Auth(t *testing.T) {
	slots := make(chan struct{}, 2)
	h := ScoreHandler("secret-token", slots)

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
		var resp cli.Result
		if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
			t.Fatalf("json: %v body=%s", err, rr.Body.String())
		}
		if resp.Code != 0 {
			t.Fatalf("code=%d body=%s", resp.Code, rr.Body.String())
		}
	})
}

func TestHealthHandler(t *testing.T) {
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	HealthHandler(rr, req)
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
	prev := cli.CommandContext
	cli.CommandContext = fn
	t.Cleanup(func() { cli.CommandContext = prev })
}
