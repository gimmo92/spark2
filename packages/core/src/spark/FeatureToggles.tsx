"use client";

import { Check, Lock } from "lucide-react";
import type { moduleFeatures } from "../config";
import { tr } from "../i18n/i18n";

export type Feature = ReturnType<typeof moduleFeatures>[number];

/** Menu entries of one module as checkboxes: checked = on. */
export function FeatureToggles({ features, hidden, onChange, disabled }: { features: Feature[]; hidden: string[]; onChange: (hidden: string[]) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {features.map((f) => {
        const on = !hidden.includes(f.href);
        return (
          <button
            key={f.href}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(on ? [...hidden, f.href] : hidden.filter((h) => h !== f.href))}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors disabled:opacity-50 ${
              on ? "border-brand bg-brand-soft text-brand" : "border-[#dfe3ea] text-faint hover:border-[#c6ccd6] hover:text-muted"
            }`}
          >
            {on ? <Check className="h-3 w-3" strokeWidth={3} /> : <Lock className="h-3 w-3" />}
            {tr(f.label)}
          </button>
        );
      })}
    </div>
  );
}

