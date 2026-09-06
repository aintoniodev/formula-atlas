export const SYSTEMS = [
  { id: "aero", name: "Aerodynamics", color: "#ff7045", short: "AERO" },
  { id: "body", name: "Bodywork", color: "#f3ae55", short: "BODY" },
  {
    id: "chassis",
    name: "Chassis & cockpit",
    color: "#9e97ed",
    short: "CHASSIS",
  },
  { id: "power", name: "Power unit", color: "#e0cb70", short: "POWER" },
  { id: "cooling", name: "Cooling", color: "#69b7d2", short: "COOLING" },
  {
    id: "suspension",
    name: "Suspension",
    color: "#7bc7a0",
    short: "SUSPENSION",
  },
  { id: "brakes", name: "Brakes", color: "#df7fa0", short: "BRAKES" },
  { id: "wheels", name: "Wheels & tyres", color: "#b8bec4", short: "WHEELS" },
] as const;
export type SystemId = (typeof SYSTEMS)[number]["id"];
export type Vec3 = [number, number, number];
export type View = "perspective" | "front" | "side" | "top" | "rear";
export type Finish =
  "paint" | "carbon" | "metal" | "rubber" | "gold" | "dark" | "red";
export interface Part {
  id: string;
  name: string;
  system: SystemId;
  description: string;
  role: string;
  material: string;
  location: string;
  related: string[];
  source: keyof typeof SOURCES;
}
export const SOURCES = {
  regulations: {
    name: "FIA · 2025 technical regulations",
    url: "https://www.fia.com/sites/default/files/fia_2025_formula_1_technical_regulations_-_issue_01_-_2024-12-11_1.pdf",
  },
  car: {
    name: "Formula 1 · The 2022 car explained",
    url: "https://www.formula1.com/en/latest/article/10-things-you-need-to-know-about-the-all-new-2022-f1-car.4OLg8DrXyzHzdoGrbqp6ye",
  },
};
export interface ViewerState {
  visible: SystemId[];
  selected: string | null;
  isolate: boolean;
  explode: number;
  view: View;
  rotate: boolean;
  wireframe: boolean;
  colors: boolean;
  reset: number;
}
export const initialState: ViewerState = {
  visible: SYSTEMS.map((s) => s.id),
  selected: null,
  isolate: false,
  explode: 0,
  view: "perspective",
  rotate: false,
  wireframe: false,
  colors: false,
  reset: 0,
};
export function isVisible(part: Part, state: ViewerState) {
  return state.isolate
    ? part.id === state.selected
    : state.visible.includes(part.system) || part.id === state.selected;
}
export function searchParts(parts: Part[], query: string) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return parts
    .filter((p) =>
      terms.every((t) =>
        `${p.name} ${p.id} ${p.system} ${p.role} ${p.description}`
          .toLowerCase()
          .includes(t),
      ),
    )
    .sort(
      (a, b) =>
        Number(b.name.toLowerCase().startsWith(query.toLowerCase())) -
        Number(a.name.toLowerCase().startsWith(query.toLowerCase())),
    );
}
