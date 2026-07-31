"use client";

import { useState } from "react";

/**
 * Seletor de nota (1..5 estrelas) que grava num input hidden `name`.
 *
 * `rotulo` prefixa o nome acessível dos botões. Isso passou a ser necessário na v4:
 * com cinco critérios na mesma tela, 25 botões chamados apenas "5 estrela(s)"
 * seriam indistinguíveis para leitor de tela (e ambíguos para teste automatizado).
 *
 * `onChange` permite ao pai reagir (ex.: prévia da nota geral) sem tirar o estado
 * daqui — os usos antigos continuam funcionando sem mudança.
 */
export function StarRating({
  name,
  defaultValue = 0,
  rotulo,
  onChange,
}: {
  name: string;
  defaultValue?: number;
  rotulo?: string;
  onChange?: (nota: number) => void;
}) {
  const [nota, setNota] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const ativo = hover || nota;

  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={rotulo}>
      <input type="hidden" name={name} value={nota || ""} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={rotulo ? `${rotulo}: ${n} estrela(s)` : `${n} estrela(s)`}
          aria-pressed={n === nota}
          onClick={() => {
            setNota(n);
            onChange?.(n);
          }}
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
