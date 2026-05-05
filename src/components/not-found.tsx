import { useLocalStorageString } from "~/hooks/use-local-storage";
import { CUTIES, LS_KEYS } from "~/lib/constants";

const FACE =
  CUTIES.NOTFOUND[Math.floor(Math.random() * CUTIES.NOTFOUND.length)];

export function NotFound() {
  const [searchCount] = useLocalStorageString(LS_KEYS.SEARCH_COUNT, "0");
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
      }}
    >
      <header style={{ position: "absolute", top: "1rem", width: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "0 1rem",
          }}
        >
          <span>
            {searchCount} {searchCount === "1" ? "search" : "searches"}
          </span>
        </div>
      </header>
      <div className="content-container">
        <h1 id="cutie">{FACE}</h1>
        <p>404 Page not found</p>
      </div>
    </div>
  );
}
