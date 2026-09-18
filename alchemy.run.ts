import { Stack } from "alchemy";
import { Website, providers, state } from "alchemy/Cloudflare";
import type { InferEnv } from "alchemy/Cloudflare";
import { gen } from "effect/Effect";

import { SITE } from "./src/site.config.ts";

const APP_NAME = "cf-unduck";

export const Site = Website.StaticSite(
  "Website",
  gen(function* websiteProps() {
    const stack = yield* Stack;

    return {
      assets: {
        notFoundHandling: "single-page-application",
        runWorkerFirst: true,
      },
      command: "bun run build",
      compatibility: {
        date: "2026-06-10",
      },
      dev: {
        command: "bun run dev:vite",
      },
      domain: stack.stage === "prod" ? SITE.domain : undefined,
      main: "./src/worker.ts",
      name: stack.stage === "prod" ? APP_NAME : `${APP_NAME}-${stack.stage}`,
      observability: {
        enabled: true,
        headSamplingRate: 0.01,
        logs: {
          enabled: true,
          headSamplingRate: 0.01,
          invocationLogs: true,
          persist: false,
        },
        traces: {
          enabled: true,
          headSamplingRate: 0.01,
          persist: false,
        },
      },
      outdir: "./dist",
      placement: {
        mode: "smart",
      },
      workersDev: /^pr-\d+$/u.test(stack.stage),
    };
  })
);

export type WorkerEnv = InferEnv<typeof Site>;

export default Stack(
  APP_NAME,
  {
    providers: providers(),
    state: state(),
  },
  gen(function* stackResources() {
    const website = yield* Site;

    return {
      url: website.url,
    };
  })
);
