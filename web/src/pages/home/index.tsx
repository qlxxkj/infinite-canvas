import { ArrowRight } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { App, Button, Image, Tag } from "antd";
import { useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";

import { fetchPrompts, type Prompt } from "@/services/api/prompts";
import i18n from "@/i18n";
import { cn } from "@/lib/utils";
import { HeroCarousel } from "./hero-carousel";

function Highlighter({ action, color, children }: { action: "highlight" | "underline"; color: string; children?: ReactNode }) {
    return (
        <span className="relative inline-block px-1">
            {action === "highlight" ? (
                <span className="absolute inset-x-0 bottom-0 top-1 rounded-sm opacity-45" style={{ backgroundColor: color }} />
            ) : (
                <span className="absolute inset-x-0 bottom-0 h-1 rounded-full opacity-80" style={{ backgroundColor: color }} />
            )}
            <span className="relative font-medium text-stone-800 dark:text-stone-200">{children}</span>
        </span>
    );
}

/** 打字机：text 变化时逐字重放，带闪烁光标 */
function useTypewriter(text: string, speedMs = 28) {
    const [shown, setShown] = useState("");
    const [caret, setCaret] = useState(false);
    useEffect(() => {
        setShown("");
        let i = 0;
        const id = setInterval(() => {
            i += 1;
            setShown(text.slice(0, i));
            if (i >= text.length) clearInterval(id);
        }, speedMs);
        return () => clearInterval(id);
    }, [text, speedMs]);
    useEffect(() => {
        const id = setInterval(() => setCaret((c) => !c), 500);
        return () => clearInterval(id);
    }, []);
    return { shown, caret };
}

export default function IndexPage() {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [promptShowcase, setPromptShowcase] = useState<Prompt[]>([]);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [heroIndex, setHeroIndex] = useState(0);

    const activeCard = promptShowcase.length ? promptShowcase[heroIndex % promptShowcase.length] : undefined;
    const { shown: typedPrompt, caret } = useTypewriter(activeCard?.prompt ?? "");

    useEffect(() => {
        void fetchPrompts({ pageSize: 12 })
            .then((data) => setPromptShowcase(data.items))
            .catch((error) => message.error(error instanceof Error ? error.message : i18n.t("home.promptError")));
    }, [message]);

    return (
        <main className="relative h-full overflow-y-auto bg-background text-stone-950 dark:text-stone-100">
            <section className="relative mx-auto min-h-[calc(100vh-4rem)] max-w-7xl overflow-hidden px-6">
                <div className="relative flex min-h-[620px] flex-col items-center justify-center pt-10 text-center">
                    <h1 className="ai-title-aurora max-w-5xl text-balance text-5xl font-semibold tracking-normal sm:text-7xl lg:text-8xl">{t("meta.title")}</h1>
                    <p className="mt-6 max-w-3xl text-balance text-lg leading-8 text-stone-500 dark:text-stone-400">
                        <Trans i18nKey="home.description" components={{ canvas: <Highlighter action="underline" color="#FF9800" />, content: <Highlighter action="highlight" color="#87CEFA" /> }} />
                    </p>

                    {/* 3D 环形 Cover Flow 轮播：数据 = 提示词卡，切换时 prompt 打字机联动 */}
                    {promptShowcase.length > 0 && (
                        <div className="mt-6 w-full max-w-7xl overflow-x-clip px-2">
                            <HeroCarousel items={promptShowcase} activeIndex={heroIndex} onIndexChange={setHeroIndex} />
                            {/* Prompt 输入框：上移覆盖卡片下缘约 1/3 */}
                            <div className="relative z-40 mx-auto -mt-40 flex min-h-24 max-w-3xl items-center gap-3 rounded-2xl border border-white/50 bg-white/40 px-5 py-5 text-left shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-stone-900/40">
                                <span className={cn("hero-typewriter-cursor shrink-0", caret && "hero-caret-on")} />
                                <span className="min-h-5 flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-stone-700 dark:text-stone-200">{typedPrompt}</span>
                                <button
                                    type="button"
                                    onClick={() => navigate("/image")}
                                    className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-md transition hover:opacity-90"
                                    style={{ backgroundColor: "#2E96FF" }}
                                >
                                    {t("home.heroCarousel.tryIt")}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <section className="relative mx-auto mb-20 max-w-6xl pt-24">
                    <div className="mb-8 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-start">
                        <div />
                        <div className="max-w-2xl text-center">
                            <h2 className="text-3xl font-semibold text-stone-950 dark:text-stone-100">{t("home.showcaseTitle")}</h2>
                            <p className="mt-3 text-base leading-7 text-stone-500 dark:text-stone-400">{t("home.showcaseDescription")}</p>
                        </div>
                        <Button type="link" onClick={() => navigate("/prompts")} className="justify-self-center md:justify-self-end" icon={<ArrowRight className="size-4" />} iconPlacement="end">
                            {t("home.viewPrompts")}
                        </Button>
                    </div>
                    <div className="grid auto-rows-[210px] gap-4 md:grid-cols-4">
                        {promptShowcase.map((item, index) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    setPreviewIndex(index);
                                    setPreviewOpen(true);
                                }}
                                className={cn(
                                    "group relative cursor-pointer overflow-hidden border border-stone-200 bg-stone-100 text-left dark:border-stone-800 dark:bg-stone-900",
                                    index === 0 && "md:col-span-2 md:row-span-2",
                                    index === 3 && "md:col-span-2",
                                )}
                            >
                                <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent p-4 text-white">
                                    <div className="mb-2 flex flex-wrap gap-1.5">
                                        {item.tags.slice(0, 2).map((tag) => (
                                            <Tag key={tag} variant="filled" className="m-0 bg-white/15 text-[11px] text-white backdrop-blur">
                                                {tag}
                                            </Tag>
                                        ))}
                                    </div>
                                    <h3 className="text-sm font-medium">{item.title}</h3>
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/75">{item.prompt}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            </section>
            <Image.PreviewGroup
                preview={{
                    open: previewOpen,
                    current: previewIndex,
                    onOpenChange: setPreviewOpen,
                    onChange: setPreviewIndex,
                }}
            >
                <div className="hidden">
                    {promptShowcase.map((item) => (
                        <Image key={item.id} src={item.coverUrl} alt={item.title} />
                    ))}
                </div>
            </Image.PreviewGroup>
        </main>
    );
}
