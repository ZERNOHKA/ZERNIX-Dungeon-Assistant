import fs from "node:fs";

const p = "src/App.tsx";
let s = fs.readFileSync(p, "utf8");
s = s.replace(
  'from "./components/ZernixDeskModals";import type { ReactNode } from "react";',
  'from "./components/ZernixDeskModals";\nimport type { ReactNode } from "react";',
);
fs.writeFileSync(p, s);
