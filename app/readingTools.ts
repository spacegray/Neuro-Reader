export function scheduledTheme(now = new Date(), zone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const hourIn = (timeZone: string) => Number(new Intl.DateTimeFormat("en-GB", {
    timeZone, hour: "2-digit", hourCycle: "h23",
  }).format(now));
  let hour;
  try { hour = hourIn(zone || "America/Los_Angeles"); }
  catch { hour = hourIn("America/Los_Angeles"); }
  return hour >= 7 && hour < 19 ? "light" : "dark";
}

const stopWords = new Set(("a an the to of for in on at by from is are was were be been being this that these those it its as with or and but if so i you he she they we them your our their his her my me us do does did can will would should could have has had not into than then there here when what which who how each all some more most very also just about through out over only may such one two").split(" "));

export function summarize(text: string) {
  const sentences = [...new Set(text.trim().split(/\n+/).flatMap(line =>
    Array.from(new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(line), part => part.segment.trim())
  ).filter(Boolean))];
  const terms = sentences.map(sentence =>
    [...new Set((sentence.toLowerCase().match(/[\p{L}][\p{L}\p{N}-]*/gu) ?? [])
      .filter(word => word.length > 2 && !stopWords.has(word)))]
  );
  const counts = new Map<string, number>();
  terms.flat().forEach(word => counts.set(word, (counts.get(word) ?? 0) + 1));
  const topics = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)!).slice(0, 4);
  const ranked = terms.map((words, index) => {
    const relevance = words.reduce((total, word) => total + (counts.get(word)! - 1), 0) / Math.sqrt(words.length || 1);
    const action = /\b(deadline|decision|approved|must|required|conclude|recommend|due)\b/i.test(sentences[index]);
    return { index, score: relevance + Number(action) + (index === 0 ? 0.3 : 0) };
  });
  const limit = Math.min(4, Math.ceil(sentences.length / 3));
  const statements = ranked.sort((a, b) => b.score - a.score).slice(0, limit)
    .sort((a, b) => a.index - b.index).map(item => sentences[item.index]);
  return { statements, topics };
}
