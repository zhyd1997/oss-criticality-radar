package main

import "testing"

func TestEnvIntOr(t *testing.T) {
	const key = "SCORE_TEST_ENV_INT"
	tests := []struct {
		val  string
		want int
	}{
		{"", 2},
		{"6", 6},
		{" 6 ", 6},
		{"six", 2},
		// Out of range: fall back instead of wrapping to a huge or negative value.
		{"99999999999999999999", 2},
	}

	for _, tt := range tests {
		t.Setenv(key, tt.val)
		if got := envIntOr(key, 2); got != tt.want {
			t.Fatalf("envIntOr(%q) = %d, want %d", tt.val, got, tt.want)
		}
	}
}
