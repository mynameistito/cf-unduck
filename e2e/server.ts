import path from "node:path";

import worker from "../src/worker";

const assetsDirectory = path.resolve(import.meta.dirname, "../dist");

const serveAsset = async (request: Request): Promise<Response> => {
  const pathname = decodeURIComponent(new URL(request.url).pathname);
  const assetPath = path.resolve(assetsDirectory, `.${pathname}`);
  if (
    assetPath !== assetsDirectory &&
    !assetPath.startsWith(`${assetsDirectory}${path.sep}`)
  ) {
    return new Response(null, { status: 404 });
  }
  const file = Bun.file(assetPath);
  if (await file.exists()) {
    return new Response(file);
  }
  return new Response(Bun.file(path.resolve(assetsDirectory, "index.html")));
};

// Exercise the real edge handler, including 302s, rather than a static SPA server.
Bun.serve({
  hostname: "127.0.0.1",
  port: 4173,
  fetch: (request) => worker.fetch(request, { ASSETS: { fetch: serveAsset } }),
});
