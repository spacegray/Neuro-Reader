import type { Track } from "./musicLibrary";

// IDs, channel credits, and titles come from the corresponding YouTube watch pages.
const mindAmend = "Jason Lewis · Mind Amend";
const greenred = "Greenred Productions - Relaxing Music";
const lofiGirl = "Lofi Girl";
const chillLab = "Chill Music Lab";

type Video = [id: string, title: string, artist: string, genre: string, mood: string];
const videos: Video[] = [
  ["H_d4HdJ3Rtg", "Calm Concentration | 10Hz–12Hz Alpha Binaural Beats for Focus & Study", "Brainwave Music", "Ambient", "Relaxing"],
  ["aRvyY_hmWtw", "2 Hour Focus Session | 15Hz Beta Binaural Beats + Calm Ambient Music", "Binaural Bandit", "Ambient", "Relaxing"],
  ["H1qQ5EAUt6s", "Music for Concentration and Focus, Binaural Beats Study Music for Work and Studying", greenred, "Ambient", "Relaxing"],
  ["IJbIvkm4S_M", "Peaceful Focus Music to Reduce Distractions | Gamma Binaural Beats", "NeuroWaves Lab Music", "Ambient", "Relaxing"],
  ["ad_mdtJcjFQ", "Block Out Distractions | 40Hz Gamma Binaural Beats for Deep Focus", "Amplifocus", "Ambient", "Relaxing"],
  ["LXsfShblX-8", "Focus Music: Binaural Beats Alpha Waves Music for Studying and Concentration", greenred, "Ambient", "Relaxing"],
  ["g1LNTAdIi8k", "Deep Focus Music - Binaural Beats Concentration Music, Study Music", greenred, "Ambient", "Relaxing"],
  ["VU1Lmx3NPmM", "40 Hz Binaural Study Session | 3 Hours Deep Work Pomodoro 50/10", "Limbic Bloom", "Ambient", "Relaxing"],
  ["qvVmgQyQ49Y", "Binaural Beat + Rain For Relaxation, Focus, Concentration and Against Stress & Anxiety (Alpha Waves)", "Tom Valkhoff", "Ambient", "Relaxing"],
  ["BmQ7qE5kQFI", "Calm Focus Music for Work | Reduce Mental Fatigue | Binaural Beats", "NeuroWaves Lab Music", "Ambient", "Relaxing"],
  ["0l0mK7Pr6sQ", "Deep Focus Study - 40Hz Gamma Binaural Beats to Increase Focus & Productivity", "MindFlow Focus", "Ambient", "Relaxing"],
  ["jQJOuoT2gbQ", "Binaural Beats Focus Music for ADHD Relief, Background Study Music", greenred, "Ambient", "Relaxing"],
  ["HAZuZaP31VM", "15Hz Beta Binaural Beats for Focus & Attention | Evidence-Based Audio for Deep Work", "Brandon Luu MD", "Ambient", "Relaxing"],
  ["HA6nSQawROM", "Super Intelligence: 14 Hz Binaural Beats Beta Waves Music for Focus, Memory and Concentration", greenred, "Ambient", "Relaxing"],
  ["Jw5czFpUPD0", "Memorize Faster — 14Hz Beta Binaural Beats for Extended Concentration | Smooth Wave (2 Hours)", "DeepHertz", "Ambient", "Relaxing"],
  ["U0eLmyJkQBc", "Focus Music, Binaural Beats Concentration Music for Studying, Super Intelligence", greenred, "Ambient", "Relaxing"],
  ["XZ4WXAxtGDc", "Super Intelligence: Focus Music, Binaural Beats Concentration Music for Studying, Study Music", greenred, "Ambient", "Relaxing"],
  ["u2RvqKCn7S4", "Super Intelligence: Memory Music, Improve Focus and Concentration with BInaural Beats Focus Music", greenred, "Ambient", "Relaxing"],
  ["wDxRkc2DJJc", "Super Focus Music - 18Hz Beta Binaural Beats, Increase productivity, concentration and Intelligence", "Study Sonic Focus", "Ambient", "Relaxing"],
  ["mg7netw1JuM", "Super Intelligence: 🍎 Memory Music, Improve Memory and Concentration, Binaural Beats Focus Music", greenred, "Ambient", "Relaxing"],
  ["0D2WnhG-KmA", "Left-Brain Focus for ADHD Brains | Deep House | Think Clearer & Faster", mindAmend, "Deep house", "Energizing"],
  ["QM1VLD16tDU", "ADHD Focus Music | Organic House | ADHD High Focus Support Isochronic", mindAmend, "Organic house", "Energizing"],
  ["Btpj6yrQQg8", "Deep Work | Melodic House | Intense Focus for ADHD Brains", mindAmend, "House", "Energizing"],
  ["F-4LUKo_W2I", "Sharp Focus for ADHD Brains | 90s Hip-Hop | ADHD High Focus Support", mindAmend, "Hip-hop", "Energizing"],
  ["A6dzSX62gEY", "Clear Mind Intense Focus | Ambient Techno | ADHD High Focus Support", mindAmend, "Techno", "Relaxing"],
  ["BzyI4CGMoLQ", "Chill Focus for ADHD | Liquid Drum and Bass | Think Clearer & Faster", mindAmend, "Drum and bass", "Relaxing"],
  ["gWdV17aBFeM", "Sustained Concentration Aid | 90s Hip Hop | ADHD High Focus Support", mindAmend, "Hip-hop", "Energizing"],
  ["YqSTh6Q__zc", "Focus Support for ADHD Brains | Deep House | Think Clearer & Faster", mindAmend, "Deep house", "Energizing"],
  ["dhV9RuIWP1M", "Deep Work & Concentration | Minimal Techno | ADHD High Focus Support", mindAmend, "Techno", "Energizing"],
  ["ElRxFroqGts", "Precision Focus for ADHD | Post-Rock | Think Clearer & Faster", mindAmend, "Post-rock", "Energizing"],
  ["v0D0goHacNc", "Eliminate Mental Friction | Jazz Hip-Hop | ADHD High Focus Support", mindAmend, "Hip-hop", "Energizing"],
  ["Uf6pmwLRQqU", "Left-Brain Focus | Lo-Fi | Think Clearer & Faster - Isochronic Tones", mindAmend, "Hip-hop", "Relaxing"],
  ["trNapQ1jWWM", "Neurodivergent Study Aid | Ambient House | Think Clearer & Faster", mindAmend, "House", "Relaxing"],
  ["zgltlEF-csA", "Peak Focus for Complex Tasks | Deep House Mix + Isochronic Tones", mindAmend, "Deep house", "Energizing"],
  ["KNuoGeD9Qeo", "Clearer and Faster Thinking - Electronic Focus Music with Isochronic Tones", mindAmend, "Electronic", "Energizing"],
  ["a8UuKMqQWg8", "Peak Mental Performance | Synthwave Mix | Think Clearer & Faster", mindAmend, "Electronic", "Energizing"],
  ["CNYmq01WlD0", "Lock Into The Zone | Chill Deep House | Focus Flow - Isochronic Tones", mindAmend, "Deep house", "Relaxing"],
  ["mPd-9jIt3bU", "Peak Focus for Complex Tasks | Drum and Bass + Beta Isochronic Tones", mindAmend, "Drum and bass", "Energizing"],
  ["iIAREQRqej0", "Chill Electronic/Hip-Hop Focus Study Music + Beta Isochronic Tones", mindAmend, "Hip-hop", "Relaxing"],
  ["53gNFOqDFcE", "study with me [pomodoro] 📚 3 hours of lofi focus music", lofiGirl, "Hip-hop", "Relaxing"],
  ["8b3fqIBrNW0", "lofi hip hop mix 📚 beats to relax/study to (Part 2)", lofiGirl, "Hip-hop", "Relaxing"],
  ["D4TtDdHLb6o", "Enter a Focus Flow Mental State - Organic House Mix + Isochronic Tones", mindAmend, "Organic house", "Relaxing"],
  ["ajNzOsE7UEs", "Mental Stamina for Deep Work | Chill Hip-Hop | Think Clearer & Faster", mindAmend, "Hip-hop", "Relaxing"],
  ["JCKBaJDRMw4", "chill music for work 💼 lofi beats to stay productive", lofiGirl, "Hip-hop", "Relaxing"],
  ["BcbQGHgDz5k", "Night Work Music for Focus & Productivity — Future Garage Mix — No AI", chillLab, "Electronic", "Relaxing"],
  ["dheqxLgg-qg", "Chill Work Music — Deep Focus and Productivity Mix for Programming, Coding", chillLab, "Electronic", "Relaxing"],
  ["G0GRBBiECvo", "Chill Coding Music — Deep Music for Work and Programming", chillLab, "Electronic", "Relaxing"],
  ["MC1jEQOfqEw", "Chillstep & Future Garage Mix — Music for Deep Programming and Work", chillLab, "Electronic", "Relaxing"],
  ["3k9JpR-fg1o", "Focus Flow - Stay Mentally Engaged | Tech House | Isochronic Tones", mindAmend, "House", "Relaxing"],
  ["BbC3gBBZDD4", "Music for Work — Deep Focus Mix for Programming, Coding", chillLab, "Electronic", "Relaxing"],
  ["WeWjP0B0YEo", "Deep Music for Focus and Stress Relief — Atmospheric Future Garage Mix", chillLab, "Electronic", "Relaxing"],
  ["cyzx45mupcQ", "4 A.M Chill Session 🌌 synthwave music for long gaming nights", lofiGirl, "Electronic", "Relaxing"],
  ["S3OAXejjZU8", "Cyber Music for Focus & Inspiration — Future Garage Mix", chillLab, "Electronic", "Relaxing"],
];

const collections: Record<string, string[]> = {
  "Binaural beats": [
    "H_d4HdJ3Rtg", "aRvyY_hmWtw", "H1qQ5EAUt6s", "IJbIvkm4S_M", "ad_mdtJcjFQ",
    "LXsfShblX-8", "g1LNTAdIi8k", "VU1Lmx3NPmM", "qvVmgQyQ49Y", "BmQ7qE5kQFI",
    "0l0mK7Pr6sQ", "jQJOuoT2gbQ", "HAZuZaP31VM", "HA6nSQawROM", "Jw5czFpUPD0",
    "U0eLmyJkQBc", "XZ4WXAxtGDc", "u2RvqKCn7S4", "wDxRkc2DJJc", "mg7netw1JuM",
  ],
  "ADHD focus": [
    "0D2WnhG-KmA", "QM1VLD16tDU", "Btpj6yrQQg8", "F-4LUKo_W2I", "A6dzSX62gEY",
    "jQJOuoT2gbQ", "BzyI4CGMoLQ", "gWdV17aBFeM", "YqSTh6Q__zc", "dhV9RuIWP1M",
    "ElRxFroqGts", "v0D0goHacNc", "Uf6pmwLRQqU", "trNapQ1jWWM", "zgltlEF-csA",
    "KNuoGeD9Qeo", "a8UuKMqQWg8", "CNYmq01WlD0", "mPd-9jIt3bU", "iIAREQRqej0",
  ],
  "Study music": [
    "53gNFOqDFcE", "H_d4HdJ3Rtg", "trNapQ1jWWM", "LXsfShblX-8", "iIAREQRqej0",
    "8b3fqIBrNW0", "H1qQ5EAUt6s", "VU1Lmx3NPmM", "Uf6pmwLRQqU", "g1LNTAdIi8k",
    "D4TtDdHLb6o", "BzyI4CGMoLQ", "U0eLmyJkQBc", "ajNzOsE7UEs", "IJbIvkm4S_M",
    "jQJOuoT2gbQ", "XZ4WXAxtGDc", "A6dzSX62gEY", "0l0mK7Pr6sQ", "aRvyY_hmWtw",
  ],
  "Work music": [
    "JCKBaJDRMw4", "BcbQGHgDz5k", "Btpj6yrQQg8", "dheqxLgg-qg", "dhV9RuIWP1M",
    "H1qQ5EAUt6s", "zgltlEF-csA", "G0GRBBiECvo", "VU1Lmx3NPmM", "ajNzOsE7UEs",
    "MC1jEQOfqEw", "BmQ7qE5kQFI", "3k9JpR-fg1o", "BbC3gBBZDD4", "CNYmq01WlD0",
    "Jw5czFpUPD0", "mPd-9jIt3bU", "a8UuKMqQWg8", "0D2WnhG-KmA", "HAZuZaP31VM",
  ],
  "Chill electronic": [
    "WeWjP0B0YEo", "CNYmq01WlD0", "8b3fqIBrNW0", "iIAREQRqej0", "cyzx45mupcQ",
    "trNapQ1jWWM", "BcbQGHgDz5k", "BzyI4CGMoLQ", "dheqxLgg-qg", "D4TtDdHLb6o",
    "MC1jEQOfqEw", "Uf6pmwLRQqU", "JCKBaJDRMw4", "S3OAXejjZU8", "ajNzOsE7UEs",
    "3k9JpR-fg1o", "G0GRBBiECvo", "53gNFOqDFcE", "BbC3gBBZDD4", "A6dzSX62gEY",
  ],
};

export const collectionNames = Object.keys(collections);
const byId = new Map<string, Track>();
for (const [id, title, artist, genre, mood] of videos) {
  const memberships = collectionNames.filter(name => collections[name].includes(id));
  const format = memberships.includes("Binaural beats") ? "Binaural beats" : artist === mindAmend ? "Isochronic tones" : "Music mix";
  byId.set(id, {
    id, title, artist, genre, mood, format,
    activities: mood === "Relaxing" ? ["Study", "Work", "Reading"] : ["Study", "Work"],
    tags: memberships.join(" "),
  });
}

export function collectionTracks(name: string): Track[] {
  if (!Object.hasOwn(collections, name)) return [];
  return collections[name].map(id => byId.get(id)!);
}

