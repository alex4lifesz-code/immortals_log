"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-void-black text-cloud-white">
        <div className="safe-area-shell flex min-h-app flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="rounded-lg border border-crimson/30 bg-crimson-deep/30 px-6 py-5 max-w-md">
            <h2 className="text-sm font-semibold text-crimson-light mb-2">Application Error</h2>
            <p className="text-xs text-mist-light mb-4 leading-relaxed">
              {error.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={reset}
              className="rounded-md border border-jade-glow/40 bg-jade-deep/30 px-4 py-2 text-xs font-semibold text-jade-light transition-colors hover:bg-jade-deep/50"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
