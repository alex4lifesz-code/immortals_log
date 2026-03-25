"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const slides = [
  {
    title: "Train with Intention",
    text: "Strength, cardio, and yoga in one compact flow.",
  },
  {
    title: "Real Progress Data",
    text: "Track volume, distance, duration, and consistency without XP gimmicks.",
  },
  {
    title: "Ink and Scroll Aesthetic",
    text: "A calligraphy-inspired interface tuned for focus.",
  },
];

export default function WelcomePage() {
  const [index, setIndex] = useState(0);
  const router = useRouter();

  const complete = () => {
    localStorage.setItem("wuxia-onboarding-complete", "true");
    router.push("/register");
  };

  return (
    <main className="min-h-screen bg-void-black px-5 py-8 text-cloud-white">
      <div className="mx-auto flex min-h-[85vh] max-w-md flex-col justify-between rounded-2xl border border-gold-dim/40 bg-ink-deep/70 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-gold">Welcome</p>
          <h1 className="mt-4 text-2xl font-semibold text-pure-white">{slides[index].title}</h1>
          <p className="mt-3 text-sm text-mist-light">{slides[index].text}</p>
        </div>

        <div>
          <div className="mb-4 flex gap-2">
            {slides.map((_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i === index ? "bg-gold" : "bg-ink-light"}`} />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push("/login")}
              className="flex-1 rounded-lg border border-ink-light px-3 py-2 text-xs uppercase tracking-wider text-mist-light"
            >
              I Have an Account
            </button>

            {index < slides.length - 1 ? (
              <button
                onClick={() => setIndex((v) => Math.min(v + 1, slides.length - 1))}
                className="flex-1 rounded-lg border border-gold/50 px-3 py-2 text-xs uppercase tracking-wider text-gold-glow"
              >
                Next
              </button>
            ) : (
              <button
                onClick={complete}
                className="flex-1 rounded-lg border border-gold/50 bg-gold-dim/20 px-3 py-2 text-xs uppercase tracking-wider text-gold-glow"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
