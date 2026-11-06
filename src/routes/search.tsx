import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

/** Reuse the app resolver for /search when local history requires the app. */
export const Route = createFileRoute("/search")({
  validateSearch: (raw: { q?: unknown }) => ({
    q:
      raw.q === undefined || raw.q === null
        ? undefined
        : z.coerce.string().parse(raw.q),
  }),
  beforeLoad: ({ search }) => redirect({ to: "/", search, replace: true }),
});
