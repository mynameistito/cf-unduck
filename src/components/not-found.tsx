import { useState } from "react";
import { useLocalStorageString } from "@/hooks/use-local-storage";
import { CUTIES, LS_KEYS } from "@/lib/constants";
import { TopBar } from "./top-bar";

export function NotFound() {
  const [searchCount] = useLocalStorageString(LS_KEYS.SEARCH_COUNT, "0");
  const [face] = useState(
    () => CUTIES.NOTFOUND[Math.floor(Math.random() * CUTIES.NOTFOUND.length)]
  );
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <TopBar searchCount={searchCount} />
      <div className="content-container">
        <h1 id="cutie">{face}</h1>
        <p>404 Page not found</p>
      </div>
    </div>
  );
}
