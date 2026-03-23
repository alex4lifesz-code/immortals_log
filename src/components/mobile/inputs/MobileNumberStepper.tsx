"use client";

import MobileButton from "@/components/mobile/inputs/MobileButton";

interface MobileNumberStepperProps {
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

export default function MobileNumberStepper({ value, onChange, step = 1, min, max }: MobileNumberStepperProps) {
  const apply = (next: number) => {
    let bounded = next;
    if (typeof min === "number") bounded = Math.max(min, bounded);
    if (typeof max === "number") bounded = Math.min(max, bounded);
    onChange(bounded);
  };

  return (
    <div className="flex items-center gap-2">
      <MobileButton variant="secondary" onClick={() => apply(value - step)} aria-label="decrease">
        -
      </MobileButton>
      <div className="min-w-14 rounded-lg border border-border bg-ink-dark px-3 py-2 text-center text-lg text-cloud-white">{value}</div>
      <MobileButton variant="secondary" onClick={() => apply(value + step)} aria-label="increase">
        +
      </MobileButton>
    </div>
  );
}
