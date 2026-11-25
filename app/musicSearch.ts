import type {Preferences,Track} from "./musicLibrary";
export type SearchFilters=Pick<Preferences,"query"|"genre"|"mood"|"activity">;
export type YouTubeMatches={source:"youtube"|"channels"|"unavailable";reason?:"sign-in"|"daily-limit"|"provider-unavailable";tracks:Track[]};

export function youtubeTerms({query,genre,mood,activity}:SearchFilters){
  const moodTerms:Record<string,string>={Focus:"Jason Lewis focus music",Ethereal:"ethereal solfeggio music without drums"};
  const parts=[query.trim(),genre,moodTerms[mood] || mood,activity==="Sprint mode"?"Jason Lewis driving house work music":activity].filter(Boolean);
  if(!query.trim() && !parts.some(term=>/music/i.test(term)))parts.push("focus music");
  return parts.join(" ");
}
