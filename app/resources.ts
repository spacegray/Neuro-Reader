export type Resource = {
  kind:"Article"|"Book"; title:string; source:string; url:string; summary:string;
  image?:string; imageAlternates?:string[]; imageCredit?:string; attribution?:string;
};

export const starters:Resource[] = [
  {kind:"Article",title:"What is neurodiversity?",source:"Harvard Health Publishing",url:"https://www.health.harvard.edu/blog/what-is-neurodiversity-202111232645",image:"https://content.health.harvard.edu/wp-content/uploads/2023/04/2869adc7-4764-4e36-8262-2e9c6a04820a.jpg",imageAlternates:["https://content.harvardhealth.org/wp-content/uploads/2023/04/2869adc7-4764-4e36-8262-2e9c6a04820a.jpg"],imageCredit:"https://www.health.harvard.edu/blog/what-is-neurodiversity-202111232645",summary:"Nicole Baumer and Julia Frueh introduce neurodiversity and explore what inclusion can look like at school, at work, and in everyday conversations."},
  {kind:"Book",title:"Divergent Mind",source:"Jenara Nerenberg · NNLM Reading Club",url:"https://www.nnlm.gov/resources/reading-club/book/divergent-mind",image:"https://d2y7ufl8l8ugun.cloudfront.net/cdn/ff/Z_ijgRdn4Kolm7r766-ab3aWY9d5b0sfdGXGVMEuBgs/1710253773/public/2024-03/Divergent%20Mind.jpg",imageAlternates:["https://covers.openlibrary.org/b/isbn/9780062876805-M.jpg?default=false"],summary:"Nerenberg looks at sensory experiences and the language women find for differences that can go unrecognized for years. The NNLM reading club pairs the book with a discussion guide."},
  {kind:"Book",title:"NeuroTribes",source:"Steve Silberman · Avery",url:"https://penguinrandomhousehighereducation.com/book/?isbn=9780399185618",image:"https://images.penguinrandomhouse.com/cover/9780399185618",imageAlternates:["https://covers.openlibrary.org/b/isbn/9780399185618-M.jpg?default=false"],summary:"Silberman traces the history of autism through the lives of families, researchers, and autistic advocates, following how the meaning of a diagnosis has changed over time."},
];

const researchShelf:Resource[] = [
  {kind:"Article",title:"Females with ADHD",source:"BMC Psychiatry · expert consensus",url:"https://pmc.ncbi.nlm.nih.gov/articles/PMC7422602/",image:"/resource-art/females-with-adhd.webp",imageCredit:"https://pmc.ncbi.nlm.nih.gov/articles/PMC7422602/",attribution:"Page thumbnail adapted from Young et al., BMC Psychiatry (2020), CC BY 4.0.",summary:"The authors examine how ADHD can be overlooked in girls and women, and discuss the roles of referral, assessment, and support across a lifetime."},
  {kind:"Article",title:"Dyslexia and reading in primary school",source:"Systematic review · PubMed Central",url:"https://pmc.ncbi.nlm.nih.gov/articles/PMC8870220/",summary:"This review brings together studies of developmental dyslexia in primary school children. Its methods show why prevalence estimates depend on the population and the criteria researchers use."},
  {kind:"Article",title:"Does bolding word beginnings change reading speed?",source:"Acta Psychologica · PubMed",url:"https://pubmed.ncbi.nlm.nih.gov/38723450/",summary:"Joshua Snell compared reading times for short paragraphs with and without bold word beginnings. The experiment offers a close look at what a speed test can measure."},
];
export function shelfFor(question:string) {
  const terms=question.toLowerCase().match(/[a-z]{4,}/g)||[];
  const matches=[...researchShelf,...starters].map(item=>({item,score:terms.filter(term=>(item.title+" "+item.summary).toLowerCase().includes(term)).length}))
    .filter(entry=>entry.score>0).sort((a,b)=>b.score-a.score).map(entry=>entry.item);
  return question==="neurodiversity" || !matches.length ? starters : matches.slice(0,4);
}

export const featuredArticles: Resource[] = [
  {
    kind: "Article",
    title: "Masking",
    source: "National Autistic Society",
    url: "https://www.autism.org.uk/advice-and-guidance/behaviour/masking",
    image:"https://s4.chorus-mk.thirdlight.com/file/24/2yeJ60P2VrnrVp2yfZs253n5w/width=482/height=230/format=JPG/fit=stretch/crop=0x82+1920x916/rev=0/diversity1920x1080.jpg",
    imageCredit:"https://www.autism.org.uk/advice-and-guidance/behaviour/masking",
    summary: "An introduction to autistic masking, with examples of how it can show up in social situations and why people may choose to mask.",
  },
  {
    kind: "Article",
    title: "ADHD in Adults: 4 Things to Know",
    source: "National Institute of Mental Health",
    url: "https://www.nimh.nih.gov/health/publications/adhd-what-you-need-to-know",
    image:"/resource-art/adhd-in-adults.webp",imageCredit:"https://www.nimh.nih.gov/health/publications/adhd-what-you-need-to-know",attribution:"Thumbnail adapted from the public-domain NIMH fact sheet. Photograph omitted.",
    summary: "A guide to adult ADHD that looks at everyday responsibilities, what an assessment involves, and where to find support.",
  },
  researchShelf[0],
];

export type SearchAnswer={kind:"Google AI Overview"|"Google Gemini"|"Source notes";text:string;sources:{title:string;url:string}[]};
const guides=[
  {item:starters[0],matches:/neurodiver/i,answer:"Neurodiversity describes variation in how people think, learn, communicate, and experience the world. The idea also invites a practical question: which parts of an environment help someone participate, and which make that harder?"},
  {item:{kind:"Article",title:"Dyslexia basics",source:"International Dyslexia Association",url:"https://dyslexiaida.org/dyslexia-basics/",summary:"A guide to how dyslexia affects word reading, spelling, and learning to connect sounds with letters."} as Resource,matches:/dyslex/i,answer:"Dyslexia can make it harder to connect letters with sounds, recognize written words accurately, or read them fluently. A reader may understand a story when hearing it and still need more time to decode the same story in print."},
  {item:researchShelf[0],matches:/women|girls|female/i,answer:"ADHD can be missed when difficulties with attention and organization are less visible than disruptive behavior. An assessment looks at the person’s history and how difficulties affect different settings, including school, home, and work."},
  {item:researchShelf[0],matches:/emoti|regulat/i,answer:"Some people with ADHD find it difficult to regulate emotions. Many factors can affect emotional regulation, so this experience alone cannot establish a diagnosis. A clinician can consider when it happens and whether there is also a persistent pattern of attention or impulse-control difficulties."},
  {item:{kind:"Article",title:"ADD vs. ADHD: What they mean",source:"Cleveland Clinic",url:"https://health.clevelandclinic.org/add-vs-adhd",summary:"A developmental pediatrician explains how the terminology changed and what an inattentive presentation means."} as Resource,matches:/\badd\b/i,answer:"ADD is an older name for what clinicians now call ADHD. People sometimes use it informally to describe primarily inattentive symptoms. The current diagnosis includes inattentive, hyperactive-impulsive, and combined presentations."},
  {item:featuredArticles[0],matches:/masking|camouflag/i,answer:"Autistic masking means hiding or changing how autistic traits appear to others. It can include rehearsing a conversation or forcing eye contact. Someone may mask to fit in or feel safer, and sustaining that effort can be exhausting."},
  {item:{kind:"Article",title:"ADHD: What you need to know",source:"National Institute of Mental Health",url:"https://www.nimh.nih.gov/health/publications/attention-deficit-hyperactivity-disorder-what-you-need-to-know",summary:"This NIMH guide includes practical ways to organize tasks, manage reminders, and build a routine."} as Resource,matches:/adhd|responsibilit/i,answer:"For daily tasks, the National Institute of Mental Health suggests keeping a routine, breaking larger projects into smaller steps, and writing down reminders. If attention difficulties regularly interfere with work or home life, a qualified clinician can help explore support."},
];
export function relatedGuides(query:string):Resource[]{
  return [...new Map(guides.filter(g=>g.matches.test(query)).map(g=>[g.item.url,g.item])).values()];
}
export const suggestedQuestions=[
  "What is neurodiversity?", "How does dyslexia affect reading?", "How is ADHD recognized in women?",
  "Can difficulty regulating emotions be a sign of ADHD?", "What’s the difference between ADD and ADHD?",
  "What is autistic masking?", "How can I manage ADHD symptoms alongside daily responsibilities?",
];
export function pickVisitQuestions(previous:string[]=[],random=Math.random) {
  const fresh=suggestedQuestions.filter(question=>!previous.includes(question));
  const pool=fresh.length>=3?fresh:[...suggestedQuestions];
  const picks:string[]=[];
  while(picks.length<3){
    const index=Math.floor(random()*pool.length);
    picks.push(pool.splice(index,1)[0]);
  }
  return picks;
}
export function guideAnswer(query:string):SearchAnswer|null {
  const index=suggestedQuestions.findIndex(q=>q.toLowerCase()===query.toLowerCase());
  const guide=guides[index];
  return guide?{kind:"Source notes",text:guide.answer,sources:[{title:guide.item.source,url:guide.item.url}]}:null;
}
