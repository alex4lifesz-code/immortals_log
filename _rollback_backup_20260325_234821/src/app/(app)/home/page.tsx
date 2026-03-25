export default function HomePage() {
  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-gold-dim/40 bg-ink-deep/70 p-4">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Wuxia Workout</p>
        <h1 className="mt-2 text-2xl font-semibold text-pure-white">Home</h1>
        <p className="mt-2 text-sm text-mist-light">Compact dashboard with quick actions, today summary, and recent activity.</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {[
          "Start Strength Workout",
          "Start Cardio Session",
          "Start Yoga Flow",
          "Quick Check-in",
        ].map((label) => (
          <button key={label} className="rounded-xl border border-ink-light bg-ink-dark/80 px-3 py-4 text-left text-xs text-cloud-white hover:border-gold/50 hover:bg-ink-mid/60">
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
