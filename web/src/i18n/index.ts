import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enUS from "@/i18n/locales/en-US";
import zhCN from "@/i18n/locales/zh-CN";
import { detectLocaleByIp } from "@/lib/ip-locale";

export type AppLocale = "zh-CN" | "en-US";

const LOCALE_STORAGE_KEY = "infinite-canvas:locale";

function getStoredLocale(): AppLocale | null {
    if (typeof localStorage === "undefined") return null;
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored === "zh-CN" || stored === "en-US" ? stored : null;
}

i18n.use(initReactI18next).init({
    resources: {
        "zh-CN": { translation: zhCN },
        "en-US": { translation: enUS },
    },
    lng: getStoredLocale() ?? "zh-CN",
    fallbackLng: "zh-CN",
    supportedLngs: ["zh-CN", "en-US"],
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
});

/**
 * Auto-resolve the locale from the visitor's IP on first visit:
 * - CN → zh-CN, other countries → en-US
 * - Only applies when the user has not explicitly chosen a language yet
 *   (i.e. `LOCALE_STORAGE_KEY` is unset). Manual switches always win.
 * Fire-and-forget: failures keep the current default.
 */
export function autoDetectLocale(): void {
    if (getStoredLocale()) return;
    void detectLocaleByIp().then((locale) => {
        if (!locale) return;
        i18n.changeLanguage(locale);
    });
}

export function changeAppLocale(locale: AppLocale) {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    return i18n.changeLanguage(locale);
}

export default i18n;
