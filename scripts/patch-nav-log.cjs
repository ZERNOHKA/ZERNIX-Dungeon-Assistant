const fs = require("node:fs");
const p = "src/App.tsx";
let s = fs.readFileSync(p, "utf8");
s = s.replace(
  /onClick=\{\(\) => setView\(id\)\}/g,
  `onClick={() => {\n                  console.debug("[ZERNIX] nav", id);\n                  setView(id);\n                }}`,
);
fs.writeFileSync(p, s);
