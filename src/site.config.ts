// Self-hosting: replace these with your own values
export const SITE = {
  author: {
    // Shown in the footer credit.
    name: "mynameistito",
    // Where the credit name links to.
    url: "https://mynameistito.com",
  },
  // Your deployed URL, also set in wrangler.jsonc.
  domain: "search.mynameistito.com",
  // GitHub user/org for the repo link.
  githubUser: "mynameistito",
  // Used in page title and OpenSearch.
  name: "cf-unduck",
  // GitHub repo name, linked in the footer.
  repo: "cf-unduck",
} as const;
