const publishers:Record<string,RegExp>={
  "techpp.com":/^\/\d{4}\/\d{2}\/\d{2}\/[\w-]+\/?$/,
  "en.wikipedia.org":/^\/wiki\/[^:?#]+$/,
  "pubmed.ncbi.nlm.nih.gov":/^\/\d+\/?$/,
  "pmc.ncbi.nlm.nih.gov":/^\/articles\/PMC\d+\/?$/,
  "www.nimh.nih.gov":/^\/health\/(publications|topics)\/[\w/-]+$/,
  "www.cdc.gov":/^\/[\w/-]+\.(html?|asp)$/,
  "www.nhs.uk":/^\/(conditions|symptoms|live-well|mental-health)\/[\w/-]+$/,
  "medlineplus.gov":/^\/[\w/-]+\.html$/,
};
export function publicArticle(raw:unknown){
  if(typeof raw!=="string" || raw.length>2048)return null;
  try{
    const url=new URL(raw);
    if(url.protocol!=="https:" || url.username || url.password || url.port || !Object.hasOwn(publishers,url.hostname)
      || !publishers[url.hostname].test(decodeURIComponent(url.pathname)))return null;
    url.search="";url.hash="";return url;
  }catch{return null;}
}
