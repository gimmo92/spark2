"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

export function Badge({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "navy" | "grey" }) {
  const tones = {
    blue: "bg-badge text-white",
    navy: "bg-[#1b3f8f] text-white",
    grey: "bg-[#e7eaf0] text-muted",
  };
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-[3px] px-[7px] py-[3px] text-[9.5px] font-extrabold uppercase leading-none tracking-[0.01em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && onOut();
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [ref, onOut, active]);
}

export interface Option {
  value: string;
  label: string;
}

/** Filter pill matching the reference: icon + label + tiny caret; highlighted when a value is set. */
export function FilterMenu({
  icon,
  label,
  activeLabel,
  options,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  activeLabel?: string;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  const selected = options.find((o) => o.value === value);
  const isActive = value !== "";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-[15px] transition-colors ${
          isActive ? "bg-brand-soft text-brand" : "text-[#3f4757] hover:bg-white"
        }`}
      >
        {isActive ? <span className="h-1.5 w-1.5 rounded-full bg-brand" /> : icon}
        <span>
          {isActive ? (
            <>
              {activeLabel ?? label}: <span className="font-semibold">{selected?.label}</span>
            </>
          ) : (
            label
          )}
        </span>
        <ChevronDown className={`h-3 w-3 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="animate-pop absolute left-0 top-[calc(100%+6px)] z-30 max-h-80 min-w-[220px] overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-[0_12px_32px_-8px_rgb(16_24_40/0.18)]">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14px] text-muted hover:bg-canvas"
          >
            Tutti
            {value === "" && <Check className="h-4 w-4 text-brand" />}
          </button>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[14px] hover:bg-canvas"
            >
              {o.label}
              {value === o.value && <Check className="h-4 w-4 text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Popover({
  trigger,
  children,
  align = "right",
}: {
  trigger: (toggle: () => void, open: boolean) => React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div ref={ref} className="relative">
      {trigger(() => setOpen((o) => !o), open)}
      {open && (
        <div
          className={`animate-pop absolute top-[calc(100%+8px)] z-30 min-w-[240px] rounded-xl border border-line bg-white p-2 shadow-[0_12px_32px_-8px_rgb(16_24_40/0.18)] ${
            align === "right" ? "right-0 origin-top-right" : "left-0"
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = "max-w-xl",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="animate-fade absolute inset-0 bg-[#16203a]/35" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-dialog relative flex max-h-[90vh] w-full ${width} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line bg-[#fafbfc] px-6 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[12px] font-semibold text-red-600">{error}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-[#dfe3ea] bg-white px-3 py-2.5 text-[15px] outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-brand focus:ring-3 focus:ring-brand/15";

export function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-lg px-4 py-2 text-[14px] font-semibold text-muted transition-colors hover:bg-canvas hover:text-ink ${props.className ?? ""}`}
    />
  );
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`btn-gradient rounded-lg px-5 py-2 text-[13px] font-extrabold uppercase tracking-tight text-white disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}
