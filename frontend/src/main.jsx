import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import Notification from "./Notification";
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <Notification/>
  </React.StrictMode>,
);
