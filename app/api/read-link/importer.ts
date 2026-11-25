import {parse} from "node-html-parser";

import {publicArticle} from "../../articleUrl.ts";

const maxBytes=2_000_000,maxChars=35_000;
export function extractPassage(html:string,source:URL){
  const doc=parse(html);
  const title=(doc.querySelector("h1")?.text || doc.querySelector("title")?.text || source.hostname).trim().slice(0,220);
  for(const node of doc.querySelectorAll("script,style,noscript,nav,footer,aside,form,iframe,dialog,figure,table,button,[hidden],[aria-hidden=true],.toc,.sharedaddy,#toc_container,.mw-editsection,.reflist,.comments,#comments,.screen-reader-text"))node.remove();
  const selectors=source.hostname==="pubmed.ncbi.nlm.nih.gov"?["#abstract"]:
    [".entry-content",".mw-parser-output","[itemprop=articleBody]","article","main","[role=main]"];
  for(const selector of selectors){
    const body=doc.querySelector(selector);
    if(!body)continue;
    const blocks:string[]=[];let length=0,truncated=false;
    for(const node of body.querySelectorAll("p,h2,h3,li")){
      if(node.parentNode?.closest("p,li"))continue;
      const line=node.text.replace(/\s+/g," ").trim();
      if(!line)continue;
      if(/^(references|further reading|external links|related (?:reads?|articles)|leave a reply|was this article helpful)\s*[:?]?$/i.test(line))break;
      if(length+line.length+2>maxChars){truncated=true;break;}
      blocks.push(line);length+=line.length+2;
    }
    if(length>=100)return {title,text:blocks.join("\n\n"),url:source.href,truncated};
  }
  throw Error("There wasn’t enough readable article text on that page. Paste a passage instead.");
}
export async function importArticle(url:URL,signal:AbortSignal,get:typeof fetch=fetch){
  let source=url;
  for(let hop=0;hop<=3;hop++){
    const response=await get(source.href,{redirect:"manual",signal,headers:{Accept:"text/html","User-Agent":"NeurotypeReader/1.0"}});
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get("Location");
      await response.body?.cancel();
      const next=location && publicArticle(new URL(location,source).href);
      if(!next)break;
      source=next;continue;
    }
    if(!response.ok || !/^text\/html\b/i.test(response.headers.get("content-type") || "") || !response.body){
      await response.body?.cancel();break;
    }
    const stream=response.body.getReader();
    const decoder=new TextDecoder();let size=0,html="";
    try{
      while(true){
        const {done,value}=await stream.read();if(done)break;
        size+=value.byteLength;
        if(size>maxBytes){await stream.cancel();throw Error("This page is too large. Paste the passage you want to read.");}
        html+=decoder.decode(value,{stream:true});
      }
      return extractPassage(html+decoder.decode(),source);
    }finally{stream.releaseLock();}
  }
  throw Error("The publisher didn’t return a public article. You can still paste its text into the editor.");
}
