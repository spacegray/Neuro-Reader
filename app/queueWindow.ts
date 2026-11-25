import type {Track} from "./musicLibrary";
export function distinctTracks(items:Track[]){
  const seen=new Set<string>();
  return items.filter(t=>!seen.has(t.id) && !!seen.add(t.id));
}
export function nextWindow(pool:Track[],anchor:Track){
  const index=pool.findIndex(item=>item.id===anchor.id);
  const following=distinctTracks([...pool.slice(index+1),...pool.slice(0,index+1)]).filter(item=>item.id!==anchor.id);
  return [anchor,...following.slice(0,9)];
}
