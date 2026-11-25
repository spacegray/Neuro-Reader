import { useEffect, useId, useRef, type ReactNode } from "react";

type Props = {
  title: string; value: number; prefix?: string; suffix?: string; caption: string;
  index: number; quiet: boolean; chart: ReactNode; children: ReactNode; expanded: boolean;
  preview: (index:number) => void; leave: (index:number) => void; stay: (index:number) => void; toggle: (index:number) => void; close: () => void;
};

export default function FactCard({ index, title, value, prefix = "", suffix = "", caption, quiet, chart, children, expanded, preview, leave, stay, toggle, close }: Props) {
  const card = useRef<HTMLElement>(null);
  const detailsId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const pointerInside = useRef(false);
  const dismiss = () => {
    trigger.current?.focus({preventScroll:true});
    close();
  };
  useEffect(() => {
    const element = card.current;
    if (!element || quiet || !window.IntersectionObserver || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      element.dataset.chartEntered = "true";
      observer.disconnect();
    }, {threshold: 0.2});
    observer.observe(element);
    return () => { observer.disconnect(); delete element.dataset.chartEntered; };
  }, [quiet]);

  return <article ref={card} className="fact-card"
    onPointerEnter={event => { if (event.pointerType === "mouse") {pointerInside.current = true; if (expanded) stay(index);} }}
    onPointerLeave={() => { pointerInside.current = false; if (!card.current?.contains(document.activeElement)) leave(index); }}
    onFocus={() => { if (expanded) stay(index); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && !pointerInside.current) leave(index); }}
    onKeyDown={event => { if (expanded && event.key === "Escape") {event.preventDefault(); dismiss();} }}>
    <h3>{title}</h3>
    <strong>{prefix + value + suffix}</strong>
    <p>{caption}</p>
    {chart}
    <button ref={trigger} className="fact-toggle" type="button" aria-expanded={expanded} aria-controls={detailsId}
      onPointerEnter={event => { if (event.pointerType === "mouse") preview(index); }}
      onPointerLeave={() => { if (!expanded && document.activeElement !== trigger.current) leave(index); }}
      onFocus={event => { if (event.currentTarget.matches(":focus-visible")) preview(index); }}
      onClick={() => toggle(index)}>Details and source</button>
    <div className="fact-reveal" data-expanded={expanded} id={detailsId} inert={!expanded} aria-hidden={!expanded}>
      <div>{children}<button type="button" className="research-close" onClick={dismiss}>Close section ×</button></div>
    </div>
  </article>;
}
