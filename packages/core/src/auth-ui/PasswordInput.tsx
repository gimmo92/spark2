"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Tooltip } from "../ui/ui";
import { tr } from "../i18n/i18n";

/** Password field with a show / hide button inside it, on the right. */
export function PasswordInput({ className = "", ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  const label = shown ? tr("Nascondi password") : tr("Mostra password");
  return (
    <span className="relative block">
      <input {...props} type={shown ? "text" : "password"} className={`${className} pr-10`} />
      <span className="absolute inset-y-0 right-1 flex items-center">
        <Tooltip label={label}>
          <button
            type="button"
            aria-label={label}
            aria-pressed={shown}
            onClick={() => setShown((v) => !v)}
            className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </Tooltip>
      </span>
    </span>
  );
}
