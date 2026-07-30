"use client";

import { useState } from "react";

/** Seletor de nota (1..5 estrelas) que grava num input hidden `name`. */
export function StarRating({ name, defaultValue = 0 }: { name: string; defaultValue?: number }) {
  const [nota, setNota] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const ativo = hover || nota;

  return (
    <div className="inline-flex items-center gap-1">
      <input type="hidden" name={name} value={nota} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} estrela(s)`}
          onClick={() => setNota(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className={`text-2xl leading-none transition-colors ${n <= ativo ? "text-amber-500" : "text-slate-300 dark:text-slate-600"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
