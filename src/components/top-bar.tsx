import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface Props {
  children?: ReactNode;
  searchCount: string;
}

export function TopBar({ searchCount, children }: Props) {
  return (
    <header className="absolute top-4 w-full">
      <div className="flex justify-between px-4">
        <Link className="hover:text-fg-strong hover:underline" to="/history">
          {searchCount} {searchCount === "1" ? "search" : "searches"}
        </Link>
        {children}
      </div>
    </header>
  );
}
