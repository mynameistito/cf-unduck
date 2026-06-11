#!/usr/bin/env bun
/**
 * Cleanup script to remove temporary files
 * Cross-platform replacement for Unix find command
 */

import { readdir, unlink } from "node:fs/promises";
import path from "node:path";

const TARGET_PATTERNS = [/^tmpclaude-/u, /^nul$/iu];
const SKIP_DIRS = new Set(["node_modules", ".git"]);

const shouldDeleteFile = (filename: string): boolean =>
  TARGET_PATTERNS.some((pattern) => pattern.test(filename));

const removeFile = async (filePath: string): Promise<void> => {
  try {
    await unlink(filePath);
  } catch {
    // Ignore errors - file may already be deleted.
  }
};

const cleanup = async (dir: string): Promise<void> => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const tasks: Promise<void>[] = [];

  for (const entry of entries) {
    const entryName = String(entry.name);
    const fullPath = path.join(dir, entryName);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entryName)) {
        continue;
      }
      tasks.push(cleanup(fullPath));
    } else if (entry.isFile() && shouldDeleteFile(entryName)) {
      tasks.push(removeFile(fullPath));
    }
  }

  await Promise.all(tasks);
};

(async () => {
  await cleanup(".");
})();
