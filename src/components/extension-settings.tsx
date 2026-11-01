import { useEffect, useState } from "react";

import { extensionStatusSchema } from "@/lib/extension-preferences";
import { EXTENSION_REQUEST } from "@/lib/extension-protocol";

/** The site remains the settings interface with or without an extension. */
export const ExtensionSettings = () => {
  const [status, setStatus] = useState<"absent" | "synced" | "error">("absent");
  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (event.source !== window || event.origin !== window.location.origin) {
        return;
      }
      const parsed = extensionStatusSchema.safeParse(event.data);
      if (parsed.success) {
        setStatus(parsed.data.ok ? "synced" : "error");
      }
    };
    window.addEventListener("message", receive);
    window.postMessage(EXTENSION_REQUEST, window.location.origin);
    return () => window.removeEventListener("message", receive);
  }, []);

  return (
    <section className="border-border mb-3 border-b pb-3">
      <h3 className="text-fg-muted mb-1.5 text-xs font-semibold tracking-wide uppercase">
        Browser extension
      </h3>
      <output className="block text-sm">
        {status === "synced" &&
          "Extension connected. Your bangs and settings are cached on this device."}
        {status === "error" &&
          "Extension connected, but settings could not sync. Your last cached settings are preserved. Try reloading this page."}
        {status === "absent" &&
          "The site works on its own. Install the optional extension for direct address-bar searches with locally cached bangs."}
      </output>
      {status === "synced" && (
        <p className="text-fg-muted mt-1 text-sm">
          In the address bar, type ! then Space, followed by your search, for
          example !gpt hello. Changes here sync automatically. With search
          history enabled, searches use the site to preserve your history.
        </p>
      )}
    </section>
  );
};
