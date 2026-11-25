import {readFileSync,readdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";

export function database() {
  const raw=new DatabaseSync(":memory:");
  const dir=new URL("../drizzle/",import.meta.url);
  for(const name of readdirSync(dir).filter(x=>x.endsWith(".sql")).sort())raw.exec(readFileSync(new URL(name,dir),"utf8"));
  function prepare(sql,params=[]){
    const stmt=raw.prepare(sql);
    return {bind:(...values)=>prepare(sql,values),first:async()=>stmt.get(...params)||null,
      all:async()=>({results:stmt.all(...params)}),run:async()=>stmt.run(...params)};
  }
  return {raw,DB:{prepare,batch:async(items)=>{raw.exec("BEGIN");try{for(const item of items)await item.run();raw.exec("COMMIT");}
    catch(e){raw.exec("ROLLBACK");throw e;}}}};
}
