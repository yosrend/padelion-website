import type { ComponentType, ReactNode, SVGProps } from "react";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/** Top of every staff page: what this page is, in one line, and its main actions. */
export function PageHead({ icon: I, eyebrow, title, desc, actions }: { icon: Icon; eyebrow?: ReactNode; title: string; desc: string; actions?: ReactNode }) {
  return (
    <header className="phead">
      <div className="phead__main">
        <span className="phead__icon" aria-hidden="true"><I /></span>
        <div className="phead__text">
          {eyebrow ? <p className="phead__eyebrow pds-num">{eyebrow}</p> : null}
          <h1 className="phead__title">{title}</h1>
          <p className="phead__desc">{desc}</p>
        </div>
      </div>
      {actions ? <div className="phead__actions">{actions}</div> : null}
    </header>
  );
}

/** Section title with a small icon and an optional one-line hint or count. */
export function SectionHead({ icon: I, title, hint, id, action }: { icon: Icon; title: string; hint?: ReactNode; id?: string; action?: ReactNode }) {
  return (
    <div className="shead">
      <h2 className="shead__title" id={id}>
        <span className="shead__icon" aria-hidden="true"><I /></span>
        {title}
      </h2>
      {hint ? <p className="shead__hint">{hint}</p> : null}
      {action ? <div className="shead__action">{action}</div> : null}
    </div>
  );
}

/** Calm empty state with an icon, used instead of a bare sentence. */
export function Empty({ icon: I, title, desc }: { icon: Icon; title: string; desc?: string }) {
  return (
    <div className="sempty">
      <span className="sempty__icon" aria-hidden="true"><I /></span>
      <p className="sempty__title">{title}</p>
      {desc ? <p className="sempty__desc">{desc}</p> : null}
    </div>
  );
}
