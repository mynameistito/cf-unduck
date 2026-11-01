import { createFileRoute, redirect } from "@tanstack/react-router";

/** Reuse the app resolver for /search when local history requires the app. */
export const Route = createFileRoute("/search")({
  validateSearch: (raw: { q?: unknown }) => ({
    q: raw.q === undefined || raw.q === null ? undefined : String(raw.q),
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/", search, replace: true });
  },
});
