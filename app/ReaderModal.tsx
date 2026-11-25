import {useEffect, useId, useRef, type ReactNode} from "react";

export default function ReaderModal({title, close, wide = false, className = "", children}: {
  title:string; close:()=>void; wide?:boolean; className?:string; children:ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const original = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
      if (original?.isConnected) original.focus({preventScroll:true});
    };
  }, []);
  return <dialog className={["reader-modal",wide && "wide",className].filter(Boolean).join(" ")} ref={ref} aria-labelledby={id}
    onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===ref.current){const box=ref.current.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)close();}}}>
    <header className="modal-head"><h2 id={id}>{title}</h2><button type="button" onClick={close} autoFocus>Close ×</button></header>
    {children}
    {wide && <div id="editor-music-slot"/>}
  </dialog>;
}
