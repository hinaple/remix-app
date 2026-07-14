import "./style.css";

import { createHostApp } from "./host/host-app.js";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app container");
}

createHostApp(app);
