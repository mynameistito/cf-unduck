import { useRef, useState } from "react";

import type { AudioController } from "@/hooks/use-audio";
import { ANIMATION_DURATION_MS } from "@/lib/constants";

interface Props {
  audio: AudioController;
  reducedMotion: boolean;
}

export const CopyUrl = ({ audio, reducedMotion }: Props) => {
  const url = `${window.location.protocol}//${window.location.host}?q=%s`;
  const [copied, setCopied] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onCopy = async () => {
    audio.play("copy");
    await navigator.clipboard.writeText(url);
    setCopied(true);
    if (!reducedMotion) {
      setFlashing(true);
    }
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
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
};
