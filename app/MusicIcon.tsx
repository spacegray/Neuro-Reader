import type {ReactNode} from "react";

const strokes:Record<string,ReactNode>={
  music:<><path d="M9 17V6l11-2v11M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="17" cy="16" rx="3" ry="2.5"/></>,
  sound:<><path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
  muted:<><path d="M3 9h4l1-1m3-2 1-1v4m0 5v5l-5-4H3V9m13-1a6 6 0 0 1 1 5"/><path d="m3 3 18 18"/></>,
  play:<path d="m8 5 11 7-11 7z" fill="currentColor"/>,
  pause:<path d="M8 5v14m8-14v14" strokeWidth="4"/>,
  next:<><path d="m6 6 10 6-10 6z" fill="currentColor"/><path d="M19 6v12"/></>,
  previous:<><path d="m18 6-10 6 10 6z" fill="currentColor"/><path d="M5 6v12"/></>,
  expand:<path d="M11 4H4v7m9 9h7v-7M4 4l6 6m10 10-6-6"/>,
};
export default function MusicIcon({name}:{name:keyof typeof strokes}) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{strokes[name]}</svg>;
}
