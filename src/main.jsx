import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import "./i18n";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <I18nextProvider i18n={i18n}>
          <App />
        </I18nextProvider>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>
);
