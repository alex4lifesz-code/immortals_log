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
        className={`w-full rounded-md border pl-8 pr-8 outline-none ${className}`.trim()}
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
          className={`absolute inset-y-0 right-2.5 flex items-center text-[13px] font-semibold leading-none transition-colors hover:text-cloud-white ${clearButtonClassName}`.trim()}
          style={{ color: "var(--text-muted)" }}
          aria-label="Clear search"
        >
          x
        </button>
      ) : null}
    </div>
  );
});

export default SearchField;
