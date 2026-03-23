"use client";

import type { InputHTMLAttributes } from "react";

interface MobileInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function MobileInput({ label, className = "", ...props }: MobileInputProps) {
  return (
    <label className="block w-full space-y-1.5">
      {label ? <span className="text-sm text-mist-light">{label}</span> : null}
      <input
        className={`min-h-12 w-full rounded-xl border border-border bg-ink-dark px-4 py-3 text-base text-cloud-white placeholder:text-mist-dark focus:border-jade focus:outline-none ${className}`}
        {...props}
      />
    </label>
  );
}
