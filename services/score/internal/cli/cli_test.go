package cli

import (
	"context"
	"encoding/json"
	"net/http"
	"os/exec"
	"strings"
	"testing"
	"time"
)

func TestRun_ExitCode(t *testing.T) {
	restoreCommandContext(t, func(ctx context.Context, name string, arg ...string) *exec.Cmd {
		// false exits 1 on POSIX.
		return exec.CommandContext(ctx, "false")
	})

	resp, status := Run(context.Background(), "https://github.com/o/r")
	if status != http.StatusOK {
		t.Fatalf("status=%d", status)
	}
	if resp.Code != 1 {
		t.Fatalf("code=%d stderr=%q", resp.Code, resp.Stderr)
	}
}

func TestRun_Success(t *testing.T) {
	restoreCommandContext(t, func(ctx context.Context, name string, arg ...string) *exec.Cmd {
		return exec.CommandContext(ctx, "true")
	})

	resp, status := Run(context.Background(), "https://github.com/o/r")
	if status != http.StatusOK || resp.Code != 0 {
		t.Fatalf("status=%d code=%d stderr=%q", status, resp.Code, resp.Stderr)
	}
}

func TestRun_Timeout(t *testing.T) {
	restoreCommandContext(t, func(ctx context.Context, name string, arg ...string) *exec.Cmd {
		return exec.CommandContext(ctx, "sleep", "30")
	})

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	start := time.Now()
	resp, status := Run(ctx, "https://github.com/o/r")
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

func TestAppendLine(t *testing.T) {
	if got := appendLine("", "a"); got != "a" {
		t.Fatalf("got %q", got)
	}
	if got := appendLine("a", "b"); got != "a\nb" {
		t.Fatalf("got %q", got)
	}
}

// Ensure Result JSON shape stays stable for API clients.
func TestResultJSONShape(t *testing.T) {
	b, err := json.Marshal(Result{Code: 0, Stdout: "out", Stderr: "err"})
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

func restoreCommandContext(t *testing.T, fn func(ctx context.Context, name string, arg ...string) *exec.Cmd) {
	t.Helper()
	prev := CommandContext
	CommandContext = fn
	t.Cleanup(func() { CommandContext = prev })
}
