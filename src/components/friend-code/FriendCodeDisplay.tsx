"use client";

import { useState, useCallback } from "react";

interface FriendCodeDisplayProps {
  code: string;
  compact?: boolean;
}

export default function FriendCodeDisplay({ code, compact = false }: FriendCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Add me on Immortal's Log",
          text: `Add me as a friend on Immortal's Log! My cultivation code is: ${code}`,
        });
      } catch {
        // User cancelled or share failed, fall back to copy
        handleCopy();
      }
    } else {
      handleCopy();
    }
  }, [code, handleCopy]);

  if (compact) {
    return (
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-ink-deep/50 border border-jade/15
                   hover:border-jade/30 transition-colors group"
        title="Click to copy friend code"
      >
        <span className="text-xs text-mist-mid">Code:</span>
        <span className="text-xs text-jade-light font-mono font-bold tracking-wider">{code}</span>
        <span className="text-[10px] text-mist-dark group-hover:text-mist-mid transition-colors">
          {copied ? "✓" : "📋"}
        </span>
      </button>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-ink-deep/50 border border-jade/20">
      <p className="text-xs text-mist-mid mb-2">Your Cultivation Code</p>
      <div className="flex items-center gap-3">
        <p className="text-jade-light font-mono text-xl tracking-wider font-bold flex-1">{code}</p>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-jade-deep/30 border border-jade/30
                       text-jade-light text-xs font-medium hover:bg-jade/20 transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={handleShare}
            className="px-3 py-1.5 rounded-lg border border-ink-light text-mist-light
                       text-xs font-medium hover:bg-ink-mid transition-colors"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
