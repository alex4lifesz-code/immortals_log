"use client";

type Segment<T extends string> = {
  value: T;
  label: string;
};

interface MobileSegmentedControlProps<T extends string> {
  value: T;
  options: Segment<T>[];
  onChange: (value: T) => void;
}

export default function MobileSegmentedControl<T extends string>({ value, options, onChange }: MobileSegmentedControlProps<T>) {
  return (
    <div
      className="grid gap-2 rounded-xl border border-border bg-ink-dark p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-12 rounded-lg px-3 text-sm font-medium transition-colors ${active ? "bg-jade text-cloud-white" : "text-mist-light"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
