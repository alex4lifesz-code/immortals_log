"use client";

interface MobileTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export default function MobileTimePicker({ value, onChange, label }: MobileTimePickerProps) {
  return (
    <label className="block space-y-1.5">
      {label ? <span className="text-sm text-mist-light">{label}</span> : null}
      <input
        type="time"
        className="min-h-12 w-full rounded-xl border border-border bg-ink-dark px-4 py-3 text-cloud-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
