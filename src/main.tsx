import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { router } from "./router";
import "./styles/global.css";

const el = document.getElementById("app");
if (!el) {
  throw new Error("App element not found");
}

createRoot(el).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
