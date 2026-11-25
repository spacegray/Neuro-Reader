const feed="https://www.youtube.com/feeds/videos.xml?channel_id=UCrpFW99zAUaJT8cKmqeagkg";
export const dynamic="force-dynamic";
let lastFeed="";
let refreshAfter=0;
let pending:Promise<void>|undefined;
async function refresh(){
  try{
    const response=await fetch(feed,{signal:AbortSignal.timeout(5500)});
    if(!response.ok)throw Error();
    const xml=await response.text();
    if(!xml.includes("<feed") || !xml.includes("<entry>"))throw Error();
    lastFeed=xml;
    refreshAfter=Date.now()+3600000;
  }catch{refreshAfter=Date.now()+60000;}
}
export async function GET(){
  if(Date.now()>=refreshAfter){
    pending??=refresh().finally(()=>{pending=undefined;});
    await pending;
  }
  return lastFeed?new Response(lastFeed,{headers:{"Content-Type":"application/atom+xml; charset=utf-8","Cache-Control":"public, max-age=3600"}}):
    new Response(null,{status:503,headers:{"Cache-Control":"no-store","Retry-After":"60"}});
}
