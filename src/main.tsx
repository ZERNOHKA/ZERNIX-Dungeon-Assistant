import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App";
import { NpcSessionProvider } from "./context/NpcSessionContext";
import { ZernixUserDataProvider } from "./context/ZernixUserDataContext";
import { ZernixGeneratorsProvider } from "./zernix/ZernixGeneratorsContext";
import { initTelegramWebApp } from "./telegram";

initTelegramWebApp();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <NpcSessionProvider>
      <ZernixUserDataProvider>
        <ZernixGeneratorsProvider>
          <App />
        </ZernixGeneratorsProvider>
      </ZernixUserDataProvider>
    </NpcSessionProvider>
  </StrictMode>
);
