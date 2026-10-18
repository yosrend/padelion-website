import { useId, useState, type ReactNode } from "react";
import { MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import { cn } from "../lib/cn";

export interface AccordionItem {
  question: string;
  answer: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** Index open on first render. Leave undefined for all closed. */
  defaultOpen?: number;
  className?: string;
}

export function Accordion({ items, defaultOpen, className }: AccordionProps) {
  const [open, setOpen] = useState<number | null>(defaultOpen ?? null);
  const baseId = useId();

  return (
    <div className={cn("pds-accordion", className)}>
      {items.map((item, i) => {
        const isOpen = open === i;
        const panelId = `${baseId}-panel-${i}`;
        return (
          <div
            key={item.question}
            className={cn("pds-accordion__item", isOpen && "pds-accordion__item--open")}
          >
            <button
              type="button"
              className="pds-accordion__trigger"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <span>{item.question}</span>
              <span className="pds-accordion__sign" aria-hidden="true">
                {isOpen ? <MinusIcon /> : <PlusIcon />}
              </span>
            </button>
            <div className="pds-accordion__panel" id={panelId} role="region">
              <div>
                <div className="pds-accordion__body">{item.answer}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
