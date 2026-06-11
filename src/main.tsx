import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { syncPrefsCookie } from "./lib/prefs-cookie";
import { router } from "./router";

import "./styles/global.css";

const loadDevTools = async (): Promise<void> => {
  if (import.meta.env.DEV) {
    await import("react-grab");
  }
};

const preloadBangs = async (): Promise<void> => {
  if (!new URLSearchParams(window.location.search).has("q")) {
    return;
  }
  try {
    await import("./lib/bangs/hashbang");
  } catch (error) {
    console.error("Failed to preload bangs", error);
  }
};

await loadDevTools();
await preloadBangs();

syncPrefsCookie();

const el = document.querySelector("#app");
if (!el) {
  throw new Error("App element not found");
}

createRoot(el).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
