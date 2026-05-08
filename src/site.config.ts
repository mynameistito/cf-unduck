// Self-hosting: replace these with your own values
export const SITE = {
  name: "cf-unduck", // used in page title and OpenSearch
  domain: "search.mynameistito.com", // your deployed URL (also set in wrangler.jsonc)
  githubUser: "mynameistito", // GitHub user/org for the repo link
  repo: "cf-unduck", // GitHub repo name, linked in the footer
  author: {
    name: "mynameistito", // shown in the footer credit
    url: "https://mynameistito.com", // where the credit name links to
  },
} as const;
