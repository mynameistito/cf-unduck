import { useEffect, useRef, useState } from "react";
import type { AudioController } from "@/hooks/use-audio";
import { ANIMATION_DURATION_MS } from "@/lib/constants";
import { SITE } from "@/site.config";

interface Props {
  audio: AudioController;
  reducedMotion: boolean;
}

export function CopyUrl({ audio, reducedMotion }: Props) {
  const [url, setUrl] = useState(`https://${SITE.domain}?q=%s`);
  const [copied, setCopied] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setUrl(`${window.location.protocol}//${window.location.host}?q=%s`);
  }, []);

  const onCopy = async () => {
    audio.play("copy");
    await navigator.clipboard.writeText(url);
    setCopied(true);
    if (!reducedMotion) {
      setFlashing(true);
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCopied(false);
      setFlashing(false);
    }, ANIMATION_DURATION_MS);
  };

  return (
    <div className="url-container">
      <input
        aria-label="Search engine URL"
        className={`url-input${flashing ? "flash-white" : ""}`}
        readOnly
        type="text"
        value={url}
      />
      <button
        aria-label="Copy URL"
        className="copy-button"
        onClick={onCopy}
        type="button"
      >
        <img
          alt=""
          height={24}
          src={copied ? "/clipboard-check.svg" : "/clipboard.svg"}
          width={24}
        />
      </button>
    </div>
  );
}
