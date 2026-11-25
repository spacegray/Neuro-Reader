export const unsupported="This request is not supported.";
export const blockedMessage="Access to this account is restricted under the site’s usage policy.";
const controls=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
export function cleanText(raw:string) {
  return raw.normalize("NFKC").replace(/[\u200b-\u200d\ufeff]/g,"").trim();
}
function words(raw:string) {
  return cleanText(raw).toLowerCase().replace(/[013457@\$]/g,c=>({"0":"o","1":"i","3":"e","4":"a","5":"s","7":"t","@":"a","$":"s"}[c] || c));
}
// A match score measures specificity of this rule. It is never an assessment of the visitor.
const rules=[
  {reason:"Directed slur",confidence:98,strike:true,pattern:/\b(?:you are|you.re|they are|they.re|all autistic people are) (?:an? |all )?(?:f[a*]ggots?|n[i*]gg(?:ers?|as?)|retards?)\b/i},
  {reason:"Targeted threat",confidence:99,strike:true,pattern:/\b(?:i (?:will|am going to|want to)|help me|tell me how to|how (?:can|do) i) (?:kill|murder|shoot|stab|beat up|torture) (?:you|them|him|her|someone|my (?:teacher|classmates?|neighbor|neighbour|coworker)|all (?:autistic|disabled) people)\b/i},
  {reason:"Targeted abuse",confidence:98,strike:true,pattern:/\b(?:help me|how (?:can|do) i|i (?:want to|will)) (?:doxx?|harass|blackmail|stalk|bully) (?:them|him|her|someone|my (?:classmates?|neighbor|neighbour|ex|coworker)|(?:an? )?(?:autistic|disabled) (?:person|child|student))\b/i},
  {reason:"Explicit material",confidence:96,strike:false,pattern:/\b(?:porn(?:ography|ographic|hub)?|explicit (?:sex|sexual) (?:stories|material|content|scenes|videos?|pictures?)|(?:erotic|adult|uncensored sex) (?:stories|videos?|clips?|scenes|pictures?|imagery)|graphic (?:gore|dismemberment|torture (?:video|footage))|gore (?:videos?|photos?|footage)|sexual fetish (?:clips?|videos?)|xxx|hentai|nsfw|onlyfans|blowjobs?|handjobs?|bestiality|hardcore sex|sextapes?|nude (?:photos?|pics?|videos?)|sex videos?)\b/i},
  {reason:"Abusive language",confidence:95,strike:false,pattern:/\b(?:motherf[u*]ck\w*|f[u*]ck\w*|sh[i*]t(?:s|ty|ting|head)?|bullsh[i*]t|b[i*]tch(?:es|y)?|assholes?|cunts?|dickheads?|n[i*]gg(?:ers?|as?)|f[a*]ggots?|retards?)\b/i},
];
export function incidentFor(text:string) {
  const value=words(text);
  const supportContext=/\b(?:someone (?:told|threatened|messaged|called) me|how (?:do|can) i report|i need (?:urgent )?help (?:with|because)|i am afraid (?:that |of )?|how (?:do|can) i stop myself|i.m scared (?:that |of )?)\b/i.test(value);
  const rule=rules.find(r=>r.pattern.test(value));
  if(rule?.strike && supportContext)return {reason:"Sensitive quoted language",confidence:60,strike:false};

  return rule?{reason:rule.reason,confidence:rule.confidence,strike:rule.strike}:null;
}
export function safeContent(text:string) {
  return typeof text==="string" && !controls.test(text) && !incidentFor(text);
}
export function supportedQuery(raw:unknown):boolean {
  if(typeof raw!=="string" || raw.length>180 || !cleanText(raw) || !safeContent(raw))return false;
  return !/(?:https?:\/\/|www\.|<\s*[\w/!]|javascript:|data:\w+\/)/i.test(raw);
}
export function validAppeal(text:unknown,max:number,min=0):text is string {
  return typeof text==="string" && cleanText(text).length>=min && text.length<=max && safeContent(text)
    && !/(?:https?:\/\/|www\.|<\s*[\w/!]|javascript:|data:\w+\/)/i.test(text);
}
