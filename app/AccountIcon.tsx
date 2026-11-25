import type {ReactNode} from "react";

const paths={
  profile:<><circle cx="12" cy="8.1" r="3.5"/><path className="icon-detail" d="M4.7 20c.45-4.4 3.05-6.7 7.3-6.7s6.85 2.3 7.3 6.7"/></>,
  status:<><path d="M12 2.8 20 6v5.3c0 5.2-3.5 8.1-8 10.1-4.5-2-8-4.9-8-10.1V6Z"/><path className="icon-detail" d="m8.1 11.7 2.6 2.5 5.3-5.3"/></>,
  preferences:<><path d="M4 7h5m5 0h6M4 17h9m5 0h2"/><circle className="icon-detail" cx="11.4" cy="7" r="2.4"/><circle className="icon-detail" cx="15.5" cy="17" r="2.4"/></>,
  feedback:<><path d="M20.5 11a7.8 7.8 0 0 1-8.4 7.6H9l-5.2 2.2 1.4-5.2A7.2 7.2 0 0 1 3.5 11a8 8 0 0 1 8.5-7.7 8 8 0 0 1 8.5 7.7Z"/><path className="icon-detail" d="M8 9h8m-8 4h5"/></>,
  history:<><path d="M4.2 9.5A8.2 8.2 0 1 1 4.1 15"/><path className="icon-detail" d="M3.8 4.5v5.4h5.4m3-2.6v5.1l3.1 1.8"/></>,
  playback:<><rect x="2.8" y="5.1" width="18.4" height="13.8" rx="4"/><path className="icon-detail" d="m10 9 5 3-5 3z"/></>,
  policy:<><path d="M5.5 3.5h9l4 4v13h-13Z"/><path className="icon-detail" d="M14 3.5V8h4.5m-10 4h7m-7 4h5"/></>,
  inbox:<><path d="m6.4 4.6-4 10.5v4.2h19.2v-4.2l-4-10.5Z"/><path className="icon-detail" d="M2.8 14.5h5.8l1.5 2h3.8l1.5-2h5.8"/></>,
  delete:<><path d="M4 7h16M9 7V4.5h6V7m-9 0 .9 13h10.2L18 7"/><path className="icon-detail" d="M10 10.5v6m4-6v6"/></>
} satisfies Record<string,ReactNode>;
export type IconName=keyof typeof paths;
export default function AccountIcon({name}:{name:IconName}){
  return <span className="account-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg></span>;
}
