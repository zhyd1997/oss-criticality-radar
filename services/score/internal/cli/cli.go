// Package cli runs the OpenSSF criticality_score CLI and captures its output.
package cli

import (
	"context"
	"errors"
	"net/http"
	"os/exec"
	"strings"
	"time"
)

const (
	// BinaryName is the criticality_score executable looked up on PATH.
	BinaryName = "criticality_score"
	// Timeout bounds a single CLI run.
	Timeout = 90 * time.Second
	// How long to wait for stdout/stderr pipes after the process is killed.
	// Keeps concurrency slots from sticking after CommandContext cancel.
	waitDelay = 2 * time.Second
)

// CommandContext is the process factory (overridable in tests).
var CommandContext = exec.CommandContext

// Path is the resolved path to criticality_score (set in main via LookPath).
// Tests may override this; production always uses LookPath result.
var Path = BinaryName

// Result is the JSON body returned by POST /score.
// Code is the CLI exit code (0 on success). When the process fails to start
// or times out, Code is -1 and details appear in Stderr.
type Result struct {
	Code   int    `json:"code"`
	Stdout string `json:"stdout"`
	Stderr string `json:"stderr"`
}

// Run executes the CLI with an argv array (never a shell).
// Returns a Result and the HTTP status to send to the client.
func Run(ctx context.Context, repoURL string) (Result, int) {
	// Argv only (no shell). JSON on stdout for the BFF; quiet logs on stderr.
	cmd := CommandContext(ctx, Path,
		"-depsdev-disable",
		"-format", "json",
		"-log", "error",
		repoURL,
	)
	// After cancel/kill, do not block forever on pipe readers holding Wait open.
	cmd.WaitDelay = waitDelay

	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	resp := Result{
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
