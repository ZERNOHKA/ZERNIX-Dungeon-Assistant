const fs = require("node:fs");

const p = "src/App.tsx";
let s = fs.readFileSync(p, "utf8");
s = s.replace(
  `import { useState } from "react";\n\nimport { ZernixProfileModal`,
  `import { useState, type ReactNode } from "react";\n\nimport { ZernixProfileModal`,
);
s = s.replace(`import type { ReactNode } from "react";\n`, "");
fs.writeFileSync(p, s);
