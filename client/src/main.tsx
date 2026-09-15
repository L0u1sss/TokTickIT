import React from "react";
import ReactDOM from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import AuthApp from "./AuthApp.js";
import App from "./App.js";
import { RequesterProvider } from "./context/RequesterContext.js";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {["/login", "/change-password", "/account"].includes(window.location.pathname)
      ? <AuthApp />
      : <RequesterProvider><App /></RequesterProvider>}
  </React.StrictMode>
);
