package api

import (
	"errors"
	"net/url"
	"regexp"
	"strings"
)

// repoNamePattern matches GitHub owner and repository names
// (same character set as the BFF shorthand parser in lib/parse-repo.ts).
var repoNamePattern = regexp.MustCompile(`^[A-Za-z0-9_.-]+$`)

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
	// Keep owner/repo conservative: no nested paths (e.g. tree/main), and only
	// GitHub name characters. u.Path is decoded, so this also rejects escaped
	// delimiters such as %23 ('#') or %3F ('?') that would change the URL.
	owner, repo := parts[0], parts[1]
	if !repoNamePattern.MatchString(owner) || !repoNamePattern.MatchString(repo) {
		return "", errors.New(errMsg)
	}

	return "https://github.com/" + owner + "/" + repo, nil
}
