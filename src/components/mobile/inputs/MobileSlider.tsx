"use client";

import type { InputHTMLAttributes } from "react";

interface MobileSliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export default function MobileSlider({ label, ...props }: MobileSliderProps) {
  return (
    <label className="block space-y-2">
      {label ? <span className="text-sm text-mist-light">{label}</span> : null}
      <input
        type="range"
        className="h-12 w-full accent-jade-glow"
        {...props}
      />
    </label>
  );
}
