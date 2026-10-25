import React from "react";
import { createRoot } from "react-dom/client";
import App from "../../admin/src/App";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App kind="store" />
  </React.StrictMode>,
);
