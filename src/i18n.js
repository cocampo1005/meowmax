import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en/common.json";
import es from "./locales/es/common.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { common: en }, es: { common: es } },
    fallbackLng: "en",
    lng: localStorage.getItem("lang") || undefined, // let detector pick if not set
    interpolation: { escapeValue: false },
    defaultNS: "common",
    detection: { order: ["localStorage", "navigator"] },
  });

export default i18n;
