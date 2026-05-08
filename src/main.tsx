import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { syncPrefsCookie } from "./lib/prefs-cookie";
import { router } from "./router";
import "./styles/global.css";

if (new URLSearchParams(window.location.search).has("q")) {
  import("./lib/bangs/hashbang").catch((err) => {
    console.error("Failed to preload bangs", err);
  });
}

syncPrefsCookie();

const el = document.getElementById("app");
if (!el) {
  throw new Error("App element not found");
}

createRoot(el).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
