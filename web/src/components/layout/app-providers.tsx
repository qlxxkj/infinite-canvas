import type { ReactNode } from "react";
import { useCallback, useEffect } from "react";
import { ProConfigProvider } from "@ant-design/pro-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App, ConfigProvider } from "antd";
import enUS from "antd/es/locale/en_US";
import zhCN from "antd/es/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { useTranslation } from "react-i18next";

import { ClientRootInit } from "@/components/layout/client-root-init";
import type { AppLocale } from "@/i18n";
import { getAntThemeConfig } from "@/lib/app-theme";
import { useThemeStore } from "@/stores/use-theme-store";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: false,
            refetchOnWindowFocus: false,
        },
    },
});

// Resolve the canonical base URL. Prefers a runtime-injected origin so SEO
// tags point at the real deployment domain; falls back to window.location.
// Key name matches what docker-entrypoint.sh writes into config.js (SITE_URL).
function getSiteUrl(): string {
    const runtime = (window as unknown as { __RUNTIME_CONFIG__?: { SITE_URL?: string } }).__RUNTIME_CONFIG__;
    const injected = runtime?.SITE_URL?.trim();
    return (injected || window.location.origin).replace(/\/$/, "");
}

function ensureMetaTag(attr: "name" | "property", key: string): HTMLMetaElement {
    let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    return el;
}

export function AppProviders({ children }: { children: ReactNode }) {
    const { i18n, t } = useTranslation();
    const theme = useThemeStore((state) => state.theme);
    const dark = theme === "dark";
    const locale = i18n.resolvedLanguage as AppLocale;

    useEffect(() => {
        document.documentElement.classList.toggle("dark", dark);
        document.documentElement.style.colorScheme = theme;
    }, [dark, theme]);

    // Sync SEO metadata (title, description, OG, canonical, hreflang, JSON-LD)
    // on every locale change so crawlers and social shares always match locale.
    const syncSeoMeta = useCallback(() => {
        const isZh = locale === "zh-CN";
        const siteUrl = getSiteUrl();
        const canonical = new URL(siteUrl);
        const ogImage = new URL(t("meta.seo.ogImage", { ns: false }) as string, siteUrl);

        document.documentElement.lang = isZh ? "zh-CN" : "en";
        document.title = t("meta.title");
        ensureMetaTag("name", "description").content = t("meta.seo.brandDescription");

        // Open Graph
        ensureMetaTag("property", "og:type").content = "website";
        ensureMetaTag("property", "og:site_name").content = t("meta.title");
        ensureMetaTag("property", "og:title").content = t("meta.title");
        ensureMetaTag("property", "og:description").content = t("meta.seo.brandDescription");
        ensureMetaTag("property", "og:url").content = canonical.toString();
        ensureMetaTag("property", "og:image").content = ogImage.toString();
        ensureMetaTag("property", "og:locale").content = isZh ? "zh_CN" : "en_US";

        // Canonical (one per page; here the app root)
        let canonicalEl = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!canonicalEl) {
            canonicalEl = document.createElement("link");
            canonicalEl.rel = "canonical";
            document.head.appendChild(canonicalEl);
        }
        canonicalEl.href = canonical.toString();

        // hreflang: alternate CN/EN views of the same app
        const enUrl = `${siteUrl}?lang=en-US`;
        const zhUrl = `${siteUrl}?lang=zh-CN`;
        const hreflangEntries: Array<[string, string]> = [
            [isZh ? "zh-CN" : "en-US", canonical.toString()],
            [isZh ? "en-US" : "zh-CN", isZh ? enUrl : zhUrl],
        ];
        document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
        for (const [lang, href] of hreflangEntries) {
            const el = document.createElement("link");
            el.rel = "alternate";
            el.hreflang = lang;
            el.href = href;
            document.head.appendChild(el);
        }

        // JSON-LD structured data (WebSite + SoftwareApplication)
        const jsonLd = [
            {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: t("meta.title"),
                url: canonical.toString(),
                description: t("meta.seo.brandDescription"),
            },
            {
                "@context": "https://schema.org",
                "@type": "SoftwareApplication",
                name: t("meta.title"),
                operatingSystem: "Web",
                applicationCategory: "MultimediaApplication",
                description: t("meta.seo.brandDescription"),
                url: canonical.toString(),
            },
        ];
        document.querySelectorAll("script[data-seo-jsonld]").forEach((el) => el.remove());
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-seo-jsonld", "true");
        script.text = JSON.stringify(jsonLd);
        document.head.appendChild(script);

        dayjs.locale(isZh ? "zh-cn" : "en");
    }, [locale, t]);

    useEffect(() => {
        syncSeoMeta();
    }, [syncSeoMeta]);

    return (
        <ConfigProvider locale={locale === "zh-CN" ? zhCN : enUS} theme={getAntThemeConfig(dark)}>
            <ProConfigProvider dark={dark}>
                <App>
                    <QueryClientProvider client={queryClient}>
                        <ClientRootInit>{children}</ClientRootInit>
                    </QueryClientProvider>
                </App>
            </ProConfigProvider>
        </ConfigProvider>
    );
}
