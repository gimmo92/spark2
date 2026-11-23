"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface MultiOption {
  value: string;
  label: string;
  hint?: string;
  group?: string;
}

/**
 * Dropdown with search and checkboxes. Selected values render as removable chips in the trigger.
 * `multiple={false}` turns it into a searchable single select.
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Seleziona…",
  searchPlaceholder = "Cerca…",
  multiple = true,
  invalid,
  maxChips = 6,
  allLabel = "Seleziona tutti",
}: {
  options: MultiOption[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  multiple?: boolean;
  invalid?: boolean;
  maxChips?: number;
  /** Label of the "select all" action (e.g. "Seleziona tutte" for feminine nouns). */
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    searchRef.current?.focus();
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(n)) : options;
  }, [options, q]);

  const toggle = (v: string) => {
    if (!multiple) {
      onChange(value[0] === v ? [] : [v]);
      setOpen(false);
      return;
    }
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.max(0, Math.min(filtered.length - 1, active + (e.key === "ArrowDown" ? 1 : -1)));
      setActive(next);
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    }
    if (e.key === "Enter" && filtered[active]) {
      e.preventDefault();
      toggle(filtered[active].value);
    }
  };

  const shown = value.slice(0, maxChips);

  return (
    <div ref={ref} className="relative">
      <div
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex min-h-[38px] w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-lg border bg-white py-1.5 pl-2.5 pr-8 text-[13px] outline-none transition-[border-color,box-shadow] focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/15 ${
          open ? "border-brand ring-3 ring-brand/15" : invalid ? "border-red-300" : "border-[#dfe3ea]"
        }`}
      >
        {value.length === 0 && <span className="px-0.5 text-faint">{placeholder}</span>}
        {multiple
          ? shown.map((v) => (
              <span key={v} className="inline-flex items-center gap-1 rounded-md bg-brand-soft py-0.5 pl-2 pr-1 text-[12px] font-semibold text-brand">
                {byValue.get(v)?.label ?? v}
                <button
                  type="button"
                  aria-label={`Rimuovi ${byValue.get(v)?.label ?? v}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(v);
                  }}
                  className="grid h-4 w-4 place-items-center rounded hover:bg-brand/15"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          : value[0] && <span className="px-0.5 font-semibold">{byValue.get(value[0])?.label ?? value[0]}</span>}
        {multiple && value.length > maxChips && (
          <span className="text-[12px] font-semibold text-muted">+{value.length - maxChips} altri</span>
        )}
        <ChevronDown className={`absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="animate-pop absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-xl border border-line bg-white shadow-[0_12px_32px_-8px_rgb(16_24_40/0.2)]">
          <div className="relative border-b border-line">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
              placeholder={searchPlaceholder}
              className="w-full py-2.5 pl-9 pr-3 text-[13px] outline-none placeholder:text-faint"
            />
          </div>
          {multiple && (
            <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-[11.5px]">
              <span className="text-muted">{value.length} selezionati</span>
              <span className="flex items-center gap-3">
                {filtered.some((o) => !value.includes(o.value)) && (
                  // with a search, only the matching options are added
                  <button
                    type="button"
                    onClick={() => onChange([...value, ...filtered.map((o) => o.value).filter((v) => !value.includes(v))])}
                    className="font-semibold text-brand hover:underline"
                  >
                    {q.trim() ? `${allLabel} (${filtered.length})` : allLabel}
                  </button>
                )}
                {value.length > 0 && (
                  <button type="button" onClick={() => onChange([])} className="font-semibold text-brand hover:underline">
                    Deseleziona tutti
                  </button>
                )}
              </span>
            </div>
          )}
          <ul ref={listRef} id={listId} role="listbox" aria-multiselectable={multiple} className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 && <li className="px-3 py-3 text-[12.5px] text-muted">Nessun risultato</li>}
            {filtered.map((o, i) => {
              const sel = value.includes(o.value);
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={sel}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => toggle(o.value)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 ${i === active ? "bg-canvas" : ""}`}
                >
                  {multiple && (
                    <span
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${
                        sel ? "border-brand bg-brand text-white" : "border-[#cfd5de] bg-white"
                      }`}
                    >
                      {sel && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[13px] ${sel ? "font-semibold" : ""}`}>{o.label}</span>
                    {o.hint && <span className="block truncate text-[11.5px] text-muted">{o.hint}</span>}
                  </span>
                  {!multiple && sel && <Check className="h-4 w-4 text-brand" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
