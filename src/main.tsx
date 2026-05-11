import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSterlingServiceWorker } from "./registerServiceWorker";

createRoot(document.getElementById("root")!).render(<App />);

registerSterlingServiceWorker();
