import { render } from "preact";
import { App } from "./ui/App";
import { WebStorageStore } from "./storage";
import "./style.css";

render(
  <App store={new WebStorageStore(localStorage)} />,
  document.getElementById("app")!,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .catch((e) => console.error("SW registration failed", e));
}
