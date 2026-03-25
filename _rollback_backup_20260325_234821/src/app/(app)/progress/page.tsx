export default function ProgressPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-pure-white">Progress</h1>
      <div className="grid grid-cols-2 gap-3">
        {["Strength Analytics", "Cardio Trends", "Yoga Consistency", "Body Check-ins"].map((card) => (
          <article key={card} className="rounded-xl border border-ink-light bg-ink-dark/80 p-3">
            <h2 className="text-xs uppercase tracking-wider text-gold">{card}</h2>
            <p className="mt-2 text-xs text-mist-light">Data-driven milestones and historical charts.</p>
          </article>
        ))}
      </div>
    </section>
  );
}
