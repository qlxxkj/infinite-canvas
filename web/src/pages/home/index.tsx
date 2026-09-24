import { ArrowRight, LogIn } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { App, Image, Tag } from "antd";
import { useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";

import { fetchPrompts, type Prompt } from "@/services/api/prompts";
import i18n from "@/i18n";
import { cn } from "@/lib/utils";
import { HeroCarousel, HeroCarouselNav } from "./hero-carousel";

/** 横滑条各能力卡的渐变色（参考 slider__card-media 深色渐变风格） */
const CARD_GRADIENTS: Record<string, string> = {
    image: "#2e96ff",
    video: "#4b2d7f",
    prompt: "#134e5e",
    asset: "#0b2e4f",
    canvas: "#4b2d7f",
};

/** 参考 HTML 里的 gstatic 媒体资源：按用途映射到首页各区块（视频 + 图片兜底） */
const G = "https://www.gstatic.com/aistudio-static";
const VIDEO_POOL = [
    `${G}/welcome/video-Gemini.mp4`,
    `${G}/nano_banana/Intuitive_image_generation_and_editing.mp4`,
    `${G}/welcome/video-Veo.mp4`,
    `${G}/welcome/video-Tts.mp4`,
    `${G}/welcome/video-Live.mp4`,
    `${G}/editorial/uploads-july20/omni-video.mp4`,
    `${G}/welcome/video-Lyria.mp4`,
] as const;
const SLIDER_VIDEOS: [string, string][] = [
    [VIDEO_POOL[0], `${G}/welcome/video-Gemini.mp4`],
    [VIDEO_POOL[1], `${G}/nano_banana/Intuitive_image_generation_and_editing.mp4`],
    [VIDEO_POOL[2], `${G}/welcome/video-Veo.mp4`],
    [VIDEO_POOL[3], `${G}/welcome/video-Tts.mp4`],
    [VIDEO_POOL[4], `${G}/welcome/video-Live.mp4`],
    [VIDEO_POOL[5], `${G}/editorial/uploads-july20/omni-video.mp4`],
    [VIDEO_POOL[6], `${G}/welcome/video-Lyria.mp4`],
];
const REMIX_VIDEOS = [
    "https://www.gstatic.com/aistudio/starter-apps/thumbnails/Neon_Snake.mp4",
    "https://www.gstatic.com/aistudio/starter-apps/thumbnails/window_seat_2.mp4",
    "https://www.gstatic.com/aistudio/starter-apps/thumbnails/sky_metropolis.mp4",
] as const;
const CASE_IMAGES = [
    "https://www.gstatic.com/aistudio-static/editorial/uploads-july20/shopify_featured.jpg",
    "https://www.gstatic.com/aistudio-static/editorial/uploads-july20/holy-water-thumbnail.jpg",
    "https://www.gstatic.com/aistudio-static/editorial/uploads-july20/CompScience_thumbnail.jpg",
] as const;

/** 视频媒体卡：优先播 mp4，加载失败回退到封面图 */
function VideoCardMedia({ src, poster, label }: { src: string; poster?: string; label: string }) {
    const [failed, setFailed] = useState(false);
    if (failed || !src) {
        return poster ? (
            <img src={poster} alt={label} className="h-full w-full object-cover" />
        ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-200 to-stone-400 dark:from-stone-800 dark:to-stone-950">
                <span className="text-4xl font-bold text-white/40 dark:text-white/25">{label.slice(0, 1) || "•"}</span>
            </div>
        );
    }
    return (
        <video
            src={src}
            poster={poster}
            muted
            loop
            playsInline
            autoPlay
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
        />
    );
}

function Highlighter({ action, color, children }: { action: "highlight" | "underline"; color: string; children?: ReactNode }) {
    return (
        <span className="relative inline-block px-1">
            {action === "highlight" ? (
                <span className="absolute inset-x-0 bottom-0 top-1 rounded-sm opacity-45" style={{ backgroundColor: color }} />
            ) : (
                <span className="absolute inset-x-0 bottom-0 h-1 rounded-full opacity-80" style={{ backgroundColor: color }} />
            )}
            <span className="relative font-medium">{children}</span>
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
    const sliderTrackRef = useRef<HTMLDivElement | null>(null);

    const activeCard = promptShowcase.length ? promptShowcase[heroIndex % promptShowcase.length] : undefined;
    const { shown: typedPrompt, caret } = useTypewriter(activeCard?.prompt ?? "");

    const totalPrompts = promptShowcase.length;
    const goToHeroPrev = () => setHeroIndex((i) => ((i - 1) % totalPrompts + totalPrompts) % totalPrompts);
    const goToHeroNext = () => setHeroIndex((i) => (i + 1) % totalPrompts);

    useEffect(() => {
        void fetchPrompts({ pageSize: 12 })
            .then((data) => setPromptShowcase(data.items))
            .catch((error) => message.error(error instanceof Error ? error.message : i18n.t("home.promptError")));
    }, [message]);

    return (
        <main className="home-page relative h-full overflow-y-auto bg-[#121317] text-white">
            {/* Hero 区：对齐参考 aistudio.google.com/welcome —— 深色底 #121317、白主文字、#b2bbc5 次级文字
               pt-20 让内容从悬浮导航栏下方开始（参考 hero padding-top:120px），滚动时内容进入导航下方毛玻璃 */}
            <section className="hero-zone relative mx-auto min-h-[calc(100vh-4rem)] w-full overflow-hidden px-5 pt-14 lg:px-10">
                <div className="relative flex min-h-[460px] flex-col items-center justify-center pt-24 text-center sm:min-h-[560px] lg:min-h-[720px] lg:pt-32">
                    {/* 粒子视频铺底（只包在轮播区，对齐参考 hero__media：welcome_hero_particles.mp4 + 四周压暗） */}
                    <HeroParticleBackground />
                    <div className="relative z-10">
                        <h1 className="ai-title-aurora max-w-5xl text-balance text-5xl font-normal tracking-[-1.44px] sm:text-6xl lg:text-[64px]">
                            {t("meta.title")}
                        </h1>
                        <p className="mt-4 max-w-3xl text-balance text-base leading-7 text-[#b2bbc5]">
                            <Trans i18nKey="home.description" components={{ canvas: <span />, content: <span /> }} />
                        </p>
                    </div>

                    {/* 3D 环形 Cover Flow 轮播：数据 = 提示词卡，切换时 prompt 打字机联动 */}
                    {promptShowcase.length > 0 && (
                        <div className="mt-6 w-full overflow-x-clip px-2">
                            <HeroCarousel items={promptShowcase} activeIndex={heroIndex} onIndexChange={setHeroIndex} cardVideos={[...VIDEO_POOL, ...VIDEO_POOL.slice(0, 2)]} />
                            {/* Prompt 悬浮框：对齐参考 hero__prompt-overlay（bottom:-40px，框体骑在卡片下缘上）
                               固定高度不随内容撑开：prompt 区单行省略，超出截断 */}
                            <div
                                className="relative z-40 mx-auto -mt-28 flex h-[175px] w-[539px] max-w-full flex-col justify-between gap-4 overflow-hidden rounded-[20px] bg-[#1F1F1F] px-8 pb-6 pt-8 text-left backdrop-blur-[33px]"
                            >
                                <p className="line-clamp-2 text-[22px] font-normal leading-[24.64px] tracking-[-0.132px] text-white">
                                    {typedPrompt}
                                    <span className={`ml-0.5 font-light text-[#2E96FF]${caret ? " hero-typewriter-cursor hero-caret-on" : ""}`}>|</span>
                                </p>
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => navigate("/image")}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E96FF] px-4 py-2 text-[17.5px] font-medium leading-[25.375px] tracking-[0.1925px] text-white transition hover:bg-[#1E88F0]"
                                    >
                                        <LogIn className="size-5 shrink-0" />
                                        {t("home.heroCarousel.tryIt")}
                                    </button>
                                </div>
                            </div>
                            {/* 胶囊切换按钮：放在提示框下方（对齐参考 hero__nav 顺序：卡片 → 提示框 → 胶囊），与提示框留出间距 */}
                            <div className="mt-5 flex justify-center">
                                <HeroCarouselNav
                                    onPrev={goToHeroPrev}
                                    onNext={goToHeroNext}
                                    prevLabel={t("home.heroCarousel.prev")}
                                    nextLabel={t("home.heroCarousel.next")}
                                    visible={totalPrompts >= 3}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <section className="relative mx-auto mb-12 max-w-[1580px] px-2 pt-20 lg:px-6">
                    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-2xl">
                            <h2 className="text-[28px] font-normal leading-[1.1] tracking-[-0.28px] text-white lg:text-[42px] lg:tracking-[-0.84px]">{t("home.showcaseTitle")}</h2>
                            <p className="mt-3 text-base leading-7 text-[#b2bbc5]">{t("home.showcaseDescription")}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate("/prompts")}
                            className="group inline-flex items-center gap-1.5 text-[14.5px] font-medium leading-[21px] tracking-[0.11px] text-white transition hover:opacity-80 lg:justify-self-end"
                        >
                            {t("home.viewPrompts")}
                            <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {promptShowcase.map((item, index) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    setPreviewIndex(index);
                                    setPreviewOpen(true);
                                }}
                                className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#18191d] p-3 text-left transition-colors duration-200 hover:bg-[#212226]"
                            >
                                <div className="w-full overflow-hidden rounded-xl">
                                    <img src={item.coverUrl} alt={item.title} className="aspect-[440/253] w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                                </div>
                                <div className="flex flex-1 flex-col justify-between gap-1 px-1 pt-3">
                                    <div className="mb-1 flex flex-wrap gap-1.5">
                                        {item.tags.slice(0, 2).map((tag) => (
                                            <Tag key={tag} variant="filled" className="m-0 bg-white/10 text-[11px] text-white/80 backdrop-blur">
                                                {tag}
                                            </Tag>
                                        ))}
                                    </div>
                                    <h3 className="text-sm font-medium text-white">{item.title}</h3>
                                    <p className="line-clamp-2 text-xs leading-5 text-[#b2bbc5]">{item.prompt}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                {/* 模型横滑条（参考 slider）：能力卡，点击跳转对应路由；标题右侧胶囊按钮左右滚动轨道 */}
                <SliderSection
                    onPrev={() => sliderTrackRef.current?.scrollBy({ left: -sliderTrackRef.current.clientWidth * 0.7, behavior: "smooth" })}
                    onNext={() => sliderTrackRef.current?.scrollBy({ left: sliderTrackRef.current.clientWidth * 0.7, behavior: "smooth" })}
                    prevLabel={t("home.heroCarousel.prev")}
                    nextLabel={t("home.heroCarousel.next")}
                    onCardClick={navigate}
                    trackRef={sliderTrackRef}
                />

                {/* Remix 二创项目（参考 remix）：分类筛选 tab + 可二创提示词网格 */}
                <RemixSection
                    prompts={promptShowcase}
                    onOpen={(item) => {
                        setPreviewIndex(promptShowcase.findIndex((p) => p.id === item.id));
                        setPreviewOpen(true);
                    }}
                    onRemix={(item) => navigate("/image", { state: { prompt: item.prompt } })}
                    onBrowse={() => navigate("/prompts")}
                />

                {/* Prompt Builder（参考 prompt-builder）：一句话输入 → 跳生图 */}
                <PromptBuilder onGo={(text) => navigate("/image", { state: { prompt: text } })} />

                {/* 案例大图（参考 card-grid）：精选提示词大图卡 */}
                <CaseGrid
                    prompts={promptShowcase.slice(0, 3)}
                    onOpen={(item) => {
                        setPreviewIndex(promptShowcase.findIndex((p) => p.id === item.id));
                        setPreviewOpen(true);
                    }}
                />
            </section>

            {/* 页脚：对齐参考 footer —— 品牌描述 + CTA，全页宽 1580px 内边距 40px */}
            <footer className="footer-zone mx-auto max-w-[1580px] px-10 pb-10">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                    <div className="flex flex-col items-start">
                        <p className="max-w-[400px] text-[24px] font-normal leading-[1.08] tracking-[-0.144px] text-white lg:max-w-[329px]">{t("home.footerDescription")}</p>
                        <button
                            type="button"
                            onClick={() => navigate("/image")}
                            style={{ color: "#0e0f12" }}
                            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-[14.5px] font-medium transition-colors hover:bg-[#e6eaf0]"
                        >
                            <LogIn className="size-4 shrink-0" />
                            {t("home.heroCarousel.tryIt")}
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-x-10 gap-y-6 lg:ml-auto">
                        <div className="flex flex-col gap-3">
                            <h4 className="text-[17.5px] font-medium text-white">{t("home.footerNav.title")}</h4>
                            {[
                                { label: t("home.footerNav.items.gen"), to: "/image" },
                                { label: t("home.footerNav.items.video"), to: "/video" },
                                { label: t("home.footerNav.items.prompts"), to: "/prompts" },
                                { label: t("home.footerNav.items.assets"), to: "/assets" },
                            ].map((link) => (
                                <button key={link.to} type="button" onClick={() => navigate(link.to)} className="text-left text-[14.5px] leading-5 text-[#b2bbc5] transition-colors hover:text-white">
                                    {link.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-col gap-3">
                            <h4 className="text-[17.5px] font-medium text-white">{t("home.footerNav.resources")}</h4>
                            <a href="https://qlxxkj.github.io/infinite-canvas/" target="_blank" rel="noopener noreferrer" className="text-[14.5px] leading-5 text-[#b2bbc5] transition-colors hover:text-white">
                                {t("home.footerNav.docs")}
                            </a>
                            <a href="https://github.com/qlxxkj/infinite-canvas" target="_blank" rel="noopener noreferrer" className="text-[14.5px] leading-5 text-[#b2bbc5] transition-colors hover:text-white">
                                {t("home.footerNav.github")}
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
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

/** Remix 二创区：分类 tab + 提示词网格（参考 remix 的 filter + card 交互） */
function RemixSection({ prompts, onOpen, onRemix, onBrowse }: { prompts: Prompt[]; onOpen: (item: Prompt) => void; onRemix: (item: Prompt) => void; onBrowse: () => void }) {
    const { t } = useTranslation();
    const [filter, setFilter] = useState("featured");
    const filters = [
        { key: "featured", label: t("home.remix.filters.featured") },
        { key: "all", label: t("home.remix.filters.all") },
        { key: "image", label: t("home.remix.filters.image") },
        { key: "video", label: t("home.remix.filters.video") },
        { key: "canvas", label: t("home.remix.filters.canvas") },
    ];
    const shown = filter === "all" ? prompts : filter === "featured" ? prompts.slice(0, 6) : prompts.slice(0, 6);
    if (shown.length === 0) return null;
    return (
        <section className="relative mx-auto max-w-[1580px] px-2 pt-20 lg:px-6">
            <div className="mx-auto mb-8 max-w-full text-center">
                <h2 className="text-[28px] font-normal leading-[1.1] tracking-[-0.5px] text-white lg:text-[42px] lg:tracking-[-0.84px]">{t("home.remix.title")}</h2>
                <div className="mt-6 flex flex-wrap justify-center gap-0">
                    {filters.map((f) => (
                        <button
                            key={f.key}
                            type="button"
                            onClick={() => setFilter(f.key)}
                            className={cn("home-remix-filter", filter === f.key && "is-active")}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="mx-auto h-px w-full bg-white/10" />
            <div className="mt-10 grid grid-cols-1 gap-x-5 gap-y-11 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((item, index) => (
                    <button
                        key={item.id}
                        type="button"
                        className="home-remix-card"
                        onClick={() => onOpen(item)}
                    >
                        <div className="home-remix-thumb">
                            {index < REMIX_VIDEOS.length ? (
                                <video
                                    src={REMIX_VIDEOS[index]}
                                    poster={item.coverUrl}
                                    muted
                                    loop
                                    playsInline
                                    autoPlay
                                    onError={(e) => {
                                        const el = e.target as HTMLVideoElement;
                                        el.outerHTML = `<img src="${item.coverUrl}" alt="${item.title}" class="absolute inset-0 h-full w-full object-cover" />`;
                                    }}
                                    className="absolute inset-0 h-full w-full object-cover"
                                />
                            ) : (
                                <img src={item.coverUrl} alt={item.title} className="absolute inset-0 h-full w-full object-cover" />
                            )}
                            <div className="home-remix-overlay">
                                <button type="button" onClick={(e) => { e.stopPropagation(); onRemix(item); }} className="home-remix-btn">
                                    {t("home.heroCarousel.tryIt")}
                                </button>
                            </div>
                        </div>
                        <h3 className="text-[17.5px] leading-[25.375px] tracking-[0.1925px] text-white">{item.title}</h3>
                        <p className="mt-1.5 line-clamp-2 text-[14.5px] leading-[21px] tracking-[0.1595px] text-[#9299a2]">{item.prompt}</p>
                    </button>
                ))}
            </div>
            <div className="mt-10 text-center">
                <button
                    type="button"
                    onClick={onBrowse}
                    style={{ color: "#0e0f12" }}
                    className="rounded-xl bg-white px-6 py-3.5 text-[17.5px] font-medium leading-[25.375px] tracking-[0.1925px] transition-colors hover:bg-[#e6eaf0]"
                >
                    {t("home.remix.openCta")}
                </button>
            </div>
        </section>
    );
}

/** 粒子舞动背景：对齐参考 HTML —— prompt-builder 区用 prompt_builder_particles.mp4（mix-blend-mode:lighten） */
function ParticleBackground() {
    return <video className="home-prompt-builder-particles" src="/media/prompt_builder_particles.mp4" muted loop playsInline autoPlay aria-hidden="true" />;
}

/** hero 区粒子视频铺底（对齐参考 hero__media：welcome_hero_particles.mp4 + 四周压暗） */
function HeroParticleBackground() {
    return <video className="hero-particles-bg" src="/media/welcome_hero_particles.mp4" muted loop playsInline autoPlay aria-hidden="true" />;
}

/** Prompt Builder：一句话输入 → 跳生图（参考 prompt-builder） */
function PromptBuilder({ onGo }: { onGo: (text: string) => void }) {
    const { t } = useTranslation();
    const [text, setText] = useState("");
    return (
        <section className="relative mx-auto max-w-[1580px] px-2 pt-20 lg:px-6">
            <div className="home-prompt-builder">
                <ParticleBackground />
                <div className="relative z-10 flex w-full flex-col items-center px-5 py-14 text-center lg:py-20">
                    <h2 className="mb-8 text-[32px] font-normal leading-[1.1] tracking-[-0.5px] text-white lg:text-[54px] lg:tracking-[-1.08px]">{t("home.promptBuilder.title")}</h2>
                    <div className="home-prompt-input-wrapper w-full">
                        <textarea
                            rows={1}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder={t("home.promptBuilder.placeholder")}
                            className="flex-1 resize-none border-none bg-transparent text-[17.5px] leading-[25.375px] tracking-[0.1925px] text-white outline-none placeholder:text-white/50"
                        />
                        <button
                            type="button"
                            onClick={() => onGo(text)}
                            disabled={!text.trim()}
                            className={cn(
                                "shrink-0 rounded-xl px-4 py-2 text-[14.5px] font-medium transition-colors",
                                text.trim() ? "bg-white text-[#0e0f12] hover:bg-[#e6eaf0]" : "cursor-default bg-[#18191d] text-[#45474d]",
                            )}
                        >
                            {t("home.promptBuilder.getStarted")}
                        </button>
                    </div>
                    <div className="mt-8 flex flex-wrap justify-center gap-8">
                        {["A cozy cabin in snow", "A neon cyberpunk city", "An isometric game world"].map((s) => (
                            <button key={s} type="button" onClick={() => setText(s)} className="home-prompt-suggestion">
                                <span>✦</span> {s}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

/** 案例大图（参考 card-grid）：精选提示词大图卡 */
function CaseGrid({ prompts, onOpen }: { prompts: Prompt[]; onOpen: (item: Prompt) => void }) {
    const { t } = useTranslation();
    if (prompts.length === 0) return null;
    return (
        <section className="relative mx-auto max-w-[1580px] px-2 pt-20 lg:px-6">
            <h2 className="mb-9 text-left text-[45px] leading-[1.1] text-white">{t("home.caseGrid.title")}</h2>
            <div className="grid grid-cols-1 gap-x-5 gap-y-11 sm:grid-cols-2 lg:grid-cols-3">
                {prompts.map((item, i) => (
                    <button key={item.id} type="button" className="home-case-card" onClick={() => onOpen(item)}>
                        <div className="home-case-thumb">
                            <img
                                src={i < CASE_IMAGES.length ? CASE_IMAGES[i] : item.coverUrl}
                                alt={item.title}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                    const el = e.target as HTMLImageElement;
                                    el.src = item.coverUrl;
                                }}
                            />
                        </div>
                        <h3 className="mb-4 text-[28px] leading-[30.2px] text-white">{item.title}</h3>
                        <span className="flex items-center gap-1 self-start text-[17.5px] font-medium leading-[25.4px] text-white transition-opacity hover:opacity-80">
                            {t("home.caseGrid.openCase")} <ArrowRight className="size-5" />
                        </span>
                    </button>
                ))}
            </div>
        </section>
    );
}

const SLIDER_CARDS = [
    { key: "image", to: "/image", icon: "✦" },
    { key: "video", to: "/video", icon: "▶" },
    { key: "prompt", to: "/prompts", icon: "❋" },
    { key: "asset", to: "/assets", icon: "▣" },
    { key: "canvas", to: "/canvas", icon: "◈" },
    { key: "image", to: "/image", icon: "✧" },
    { key: "video", to: "/video", icon: "◉" },
] as const;

/** 模型横滑条（参考 slider）：能力卡 + 标题右侧胶囊按钮，点击左右滚动轨道 */
function SliderSection({ onPrev, onNext, prevLabel, nextLabel, onCardClick, trackRef }: { onPrev: () => void; onNext: () => void; prevLabel: string; nextLabel: string; onCardClick: (to: string) => void; trackRef: React.RefObject<HTMLDivElement | null> }) {
    const { t } = useTranslation();
    return (
        <section className="relative mx-auto mb-0 max-w-[1580px] overflow-hidden px-2 pt-20 lg:px-6">
            <div className="mb-6 flex items-end justify-between">
                <h2 className="text-[28px] font-normal leading-[1.1] tracking-[-0.5px] text-white lg:text-[42px] lg:tracking-[-0.84px]">{t("home.slider.title")}</h2>
                <div className="flex-1" />
                <HeroCarouselNav onPrev={onPrev} onNext={onNext} prevLabel={prevLabel} nextLabel={nextLabel} visible={true} />
            </div>
            {/* 轨道可视区 = section 内容宽，右侧露半个被 section overflow-hidden 裁切（对齐参考）；
                末尾补一张 2/3 卡宽的纯占位槽（不可点、透明）把 scrollWidth 加宽，使末卡滚到末尾时完整显示、占位槽留右边被裁 */}
            <div ref={trackRef} className="home-slider-track hide-scrollbar flex gap-4 overflow-x-auto scroll-smooth">
                {SLIDER_CARDS.map((card, i) => {
                    const videoSrc = i < SLIDER_VIDEOS.length ? SLIDER_VIDEOS[i][1] : undefined;
                    return (
                        <button key={`${card.key}-${i}`} type="button" onClick={() => onCardClick(card.to)} className="home-slider-card group shrink-0 cursor-pointer">
                            <div className="home-slider-media relative" style={{ background: `linear-gradient(135deg, #1c1e23, ${CARD_GRADIENTS[card.key]})` }}>
                                {videoSrc && (
                                    <video src={videoSrc} muted loop playsInline autoPlay onError={(e) => ((e.target as HTMLVideoElement).style.display = "none")} className="absolute inset-0 h-full w-full object-cover" />
                                )}
                                <div className="home-slider-overlay">
                                    <span className="mr-3 text-[32px] leading-none text-white/90">{card.icon}</span>
                                    <div className="flex min-w-0 flex-col">
                                        <span className="truncate text-[14.5px] leading-[21.025px] text-white">{t(`home.slider.cards.${card.key}.name`)}</span>
                                        <span className="truncate text-[14.5px] leading-[21.025px] text-[#cdd4dc]">{t(`home.slider.cards.${card.key}.desc`)}</span>
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
                {/* 末位占位槽（宽 2/3 卡，透明）：末卡后留白被裁，使末卡滚到末尾时可再往左移 2/3 卡距离、完整露出 */}
                <div className="home-slider-card home-slider-card--spacer home-slider-spacer--two-thirds shrink-0" aria-hidden="true" />
            </div>
        </section>
    );
}
