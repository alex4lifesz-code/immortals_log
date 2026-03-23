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
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="rounded-lg border border-crimson/30 bg-[#1a0a0a] px-6 py-5 max-w-md">
            <h2 className="text-sm font-semibold text-[#ff6b6b] mb-2">Application Error</h2>
            <p className="text-xs text-[#8a9aad] mb-4 leading-relaxed">
              {error.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={reset}
              className="rounded-md border border-[#3a8f8f]/40 bg-[#0a2020]/30 px-4 py-2 text-xs font-semibold text-[#5ecfcf] transition-colors hover:bg-[#0a2020]/50"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
