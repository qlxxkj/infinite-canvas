import { LogIn, Menu } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { AppConfigModal } from "@/components/layout/app-config-modal";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { useAgentStore } from "@/stores/use-agent-store";
import { changeAppLocale, type AppLocale } from "@/i18n";

export function AppTopNav() {
    const { t, i18n } = useTranslation();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const autoConnectRef = useRef(false);
    const agentToken = useAgentStore((state) => state.token);
    const agentEnabled = useAgentStore((state) => state.enabled);
    const agentConnected = useAgentStore((state) => state.connected);
    const connectAgent = useAgentStore((state) => state.connectAgent);
    const hideHeader = /^\/canvas\/[^/]+/.test(pathname);
    const slug = pathname.split("/").filter(Boolean)[0];
    const activeToolSlug = navigationTools.some((tool) => tool.slug === slug) ? (slug as NavigationToolSlug) : undefined;

    const locale = i18n.resolvedLanguage as AppLocale;
    const nextLocale = locale === "zh-CN" ? "en-US" : "zh-CN";
    const languageLabel = t("topNav.switchLanguage", { language: t(nextLocale === "zh-CN" ? "locale.zhCN" : "locale.enUS") });

    useEffect(() => {
        if (autoConnectRef.current || agentEnabled || agentConnected || !agentToken.trim()) return;
        autoConnectRef.current = true;
        connectAgent({ silent: true });
    }, [agentConnected, agentEnabled, agentToken, connectAgent]);

    return (
        <>
            {!hideHeader ? (
                <header className="app-top-nav sticky top-0 z-[60] h-14 shrink-0 sm:h-[81px]">
                    <div className="mx-auto flex h-full max-w-[1580px] items-stretch justify-between gap-3 px-4 sm:gap-5 sm:px-6">
                        <div className="flex min-w-0 items-center">
                            <Link to="/" className="flex h-full shrink-0 items-center gap-2 text-sm font-semibold leading-none tracking-tight text-white transition hover:opacity-80">
                                <span
                                    className="size-5 shrink-0 bg-current"
                                    style={{
                                        mask: "url(/logo.svg) center / contain no-repeat",
                                        WebkitMask: "url(/logo.svg) center / contain no-repeat",
                                    }}
                                />
                                <span className="hidden text-base font-medium text-white min-[480px]:block">{t("meta.title")}</span>
                            </Link>

                            <button
                                type="button"
                                className="ml-2 inline-flex size-8 shrink-0 items-center justify-center text-white/70 transition hover:text-white md:hidden"
                                onClick={() => setMobileNavOpen(true)}
                                aria-label={t("topNav.openMenu")}
                                title={t("topNav.menu")}
                            >
                                <Menu className="size-5" />
                            </button>

                            <nav className="hide-scrollbar ml-8 hidden h-[81px] min-w-0 items-center gap-7 overflow-x-auto md:flex">
                                {navigationTools.map((tool) => {
                                    const Icon = tool.icon;
                                    const active = tool.slug === activeToolSlug;
                                    return (
                                        <Link
                                            key={tool.slug}
                                            to={`/${tool.slug}`}
                                            className={cn(
                                                "relative flex h-14 shrink-0 items-center gap-2 text-sm leading-6 transition after:absolute after:inset-x-0 after:bottom-0 after:h-px",
                                                active
                                                    ? "font-medium text-white after:bg-white"
                                                    : "text-[#cdd4dc] after:bg-transparent hover:text-white",
                                            )}
                                        >
                                            <Icon className="size-4" />
                                            <span className="truncate">{t(`navigation.${tool.slug}`)}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="my-auto flex h-9 min-w-0 items-center justify-end gap-2 justify-self-end whitespace-nowrap">
                            {/* 仅保留中英文语言切换（参考 nav 右侧，hover 变白） */}
                            <button
                                type="button"
                                onClick={() => void changeAppLocale(nextLocale)}
                                aria-label={languageLabel}
                                title={languageLabel}
                                className="inline-flex size-8 items-center justify-center rounded-md text-[11px] font-semibold tracking-tight text-[#cdd4dc] transition-colors hover:bg-white/10 hover:text-white"
                            >
                                {locale === "zh-CN" ? "中" : "EN"}
                            </button>
                            {/* 参考 nav__cta：右侧白色「Get started」主按钮 */}
                            <button
                                type="button"
                                onClick={() => navigate("/image")}
                                style={{ color: "#0e0f12" }}
                                className="ml-4 inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-[13px] font-medium leading-5 transition-colors hover:bg-[#e6eaf0] sm:ml-6 sm:px-4 sm:py-2 sm:text-[14.5px] sm:leading-[21px]"
                            >
                                <LogIn className="size-4 shrink-0" style={{ color: "#0e0f12" }} />
                                <span className="hidden min-[480px]:inline">{t("topNav.getStarted")}</span>
                            </button>
                        </div>
                    </div>
                </header>
            ) : null}

            <MobileNavDrawer open={mobileNavOpen} activeToolSlug={activeToolSlug} onClose={() => setMobileNavOpen(false)} />
            <AppConfigModal />
        </>
    );
}
