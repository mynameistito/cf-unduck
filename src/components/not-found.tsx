import { useState } from "react";

import { useLocalStorageString } from "@/hooks/use-local-storage";
import { CUTIES, LS_KEYS } from "@/lib/constants";

import { TopBar } from "./top-bar";

const useRandomNotFoundFace = () => {
  const [notFoundFace, setNotFoundFace] = useState(() =>
    (() => {
      const [randomValue = 0] = crypto.getRandomValues(new Uint32Array(1));
      return (
        CUTIES.NOTFOUND[randomValue % CUTIES.NOTFOUND.length] ??
        CUTIES.NOTFOUND[0] ??
        ""
      );
    })()
  );
  return [notFoundFace, setNotFoundFace] as const;
};

export const NotFound = () => {
  const [searchCount] = useLocalStorageString(LS_KEYS.SEARCH_COUNT, "0");
  const [notFoundFace] = useRandomNotFoundFace();

  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <TopBar searchCount={searchCount} />
      <div className="content-container">
        <h1 aria-hidden="true" id="cutie">
          {notFoundFace}
        </h1>
        <h1>404 Page not found</h1>
      </div>
    </div>
  );
};
