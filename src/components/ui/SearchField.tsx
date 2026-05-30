"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  wrapperClassName?: string;
  iconClassName?: string;
  clearButtonClassName?: string;
};

const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  {
    value,
    onChange,
    onClear,
    wrapperClassName = "",
    className = "",
    iconClassName = "",
    clearButtonClassName = "",
    type = "text",
    ...props
  },
  ref,
) {
  const hasValue = value.trim().length > 0;

  return (
    <div className={`relative ${wrapperClassName}`.trim()}>
      <span
        className={`pointer-events-none absolute inset-y-0 left-2.5 flex items-center ${iconClassName}`.trim()}
        style={{ color: "var(--text-muted)" }}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M13.5 13.5L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>

      <input
        {...props}
        ref={ref}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`polished-focus touch-manipulation h-11 w-full rounded-lg border pl-8 pr-10 text-sm transition-[border-color,box-shadow,background-color] duration-200 ${className}`.trim()}
        style={{
          borderColor: "color-mix(in srgb, var(--border) 88%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--surface) 94%, black)",
          color: "var(--text-primary)",
        }}
      />

      {hasValue ? (
        <button
          type="button"
          onClick={() => {
            if (onClear) {
              onClear();
              return;
            }
            onChange("");
          }}
          className={`polished-focus touch-manipulation absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[13px] font-semibold leading-none transition-colors hover:text-cloud-white ${clearButtonClassName}`.trim()}
          style={{ color: "var(--text-muted)" }}
          aria-label="Clear search"
        >
          ×
        </button>
      ) : null}
    </div>
  );
});

export default SearchField;
