"use client";
import { useId, useState } from "react";
export function UsageTooltip({
  label,
  children,
  detail,
}: {
  label: string;
  children: React.ReactNode;
  detail: React.ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="usage-hover"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="usage-hover-trigger"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        {children}
      </button>
      {open && (
        <span role="tooltip" id={id} className="usage-tooltip">
          {detail}
        </span>
      )}
    </span>
  );
}
