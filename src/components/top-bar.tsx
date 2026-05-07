import type { ReactNode } from "react";

interface Props {
  children?: ReactNode;
  searchCount: string;
}

export function TopBar({ searchCount, children }: Props) {
  return (
    <header className="absolute top-4 w-full">
      <div className="flex justify-between px-4">
        <span>
          {searchCount} {searchCount === "1" ? "search" : "searches"}
        </span>
        {children}
      </div>
    </header>
  );
}
