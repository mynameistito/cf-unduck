import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface Props {
  children?: ReactNode;
  searchCount: string;
}

/** Render the navigation bar and search count.
 * @param props - Component properties.
 * @returns The rendered interface.
 */
export const TopBar = ({ searchCount, children }: Props) => (
  <header className="absolute top-4 w-full">
    <div className="flex justify-between px-4">
      <Link className="hover:text-fg-strong hover:underline" to="/history">
        {searchCount} {searchCount === "1" ? "search" : "searches"}
      </Link>
      {children}
    </div>
  </header>
);
