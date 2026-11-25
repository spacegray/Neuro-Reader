export const profiles = [
  { id: "paper", name: "Silver Paper", swatch: "#c5c5c5" },
  { id: "graphite", name: "Graphite", swatch: "#555555" },
  { id: "original", name: "Original", swatch: "#61d7ec" },
  { id: "blue", name: "Luminous Blue", swatch: "#566eee" },
  { id: "lilac", name: "Peaceful Lilac", swatch: "#d9c8ed" },
  { id: "maize", name: "Soft Maize", swatch: "#f3d888" },
  { id: "rose", name: "Desert Rose", swatch: "linear-gradient(120deg, #ac566f 50%, #f4bdbe 50%)" },
  { id: "butter", name: "Butter Sky", swatch: "linear-gradient(120deg, #eada8c 50%, #a3c4e5 50%)" },
  { id: "tide", name: "Tide & Espresso", swatch: "linear-gradient(120deg, #b1d4d0 50%, #52352d 50%)" },
  { id: "green", name: "Deep Green", swatch: "#397159" },
];

export const inkModes = ["Neutral", "Palette", "Two-tone", "Bright"] as const;
export type InkMode = typeof inkModes[number];

