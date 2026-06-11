#!/usr/bin/env bun
/**
 * Cleanup script to remove temporary files
 * Cross-platform replacement for Unix find command
 */

import { unlink } from "node:fs/promises";

import { Glob } from "bun";

const TARGET_GLOBS = ["**/tmpclaude-*", "**/nul"];
const SKIP_DIRS = ["node_modules", ".git"];

const removeFile = async (filePath: string): Promise<void> => {
  try {
    await unlink(filePath);
  } catch {
    // Ignore errors - file may already be deleted.
  }
};

const cleanup = async (dir: string): Promise<void> => {
  const tasks = TARGET_GLOBS.map(async (pattern) => {
    const glob = new Glob(pattern);
    for await (const filePath of glob.scan({ cwd: dir, onlyFiles: true })) {
      if (
        SKIP_DIRS.some((skipDir) => filePath.split(/[\\/]/u).includes(skipDir))
      ) {
        continue;
      }
      await removeFile(filePath);
    }
  });

  await Promise.all(tasks);
};

(async () => {
  await cleanup(".");
})();
