import process from "node:process";

const build = Bun.spawn(["bun", "scripts/build-extension.ts"], {
  env: { ...process.env, EXTENSION_SITE_URL: "http://127.0.0.1:4173" },
  stdout: "inherit",
  stderr: "inherit",
});
if ((await build.exited) !== 0) {
  process.exit(1);
}
const tests = Bun.spawn(
  ["bun", "x", "playwright", "test", "--config=playwright-extension.config.ts"],
  {
    stdout: "inherit",
    stderr: "inherit",
  }
);
process.exit(await tests.exited);
