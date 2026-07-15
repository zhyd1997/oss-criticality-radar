export type ParsedRepo = {
  owner: string;
  name: string;
  url: string;
};

/**
 * Parse a GitHub repository URL or shorthand into owner/name.
 * Accepts: https://github.com/owner/repo, github.com/owner/repo, owner/repo
 */
export function parseGitHubRepo(input: string): ParsedRepo {
  const raw = input.trim();
  if (!raw) {
    throw new Error("Please enter a GitHub repository (owner/repo or URL)");
  }

  // Shorthand: owner/repo
  const shorthand = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (shorthand) {
    const owner = shorthand[1];
    const name = shorthand[2];
    return {
      owner,
      name,
      url: `https://github.com/${owner}/${name}`,
    };
  }

  let url: URL;
  try {
    const withProtocol = raw.startsWith("http://") || raw.startsWith("https://")
      ? raw
      : `https://${raw}`;
    url = new URL(withProtocol);
  } catch {
    throw new Error(
      "Invalid repository. Expected owner/repo or https://github.com/owner/repo",
    );
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host !== "github.com") {
    throw new Error("Only GitHub repositories are supported (github.com)");
  }

  const parts = url.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("URL must include owner and repository name");
  }

  const owner = parts[0];
  const name = parts[1];
  return {
    owner,
    name,
    url: `https://github.com/${owner}/${name}`,
  };
}
