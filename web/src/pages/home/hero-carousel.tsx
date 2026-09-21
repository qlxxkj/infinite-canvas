import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { type KeyboardEvent, type PointerEvent, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Prompt } from "@/services/api/prompts";
import { cn } from "@/lib/utils";

/** 自动播放间隔（ms） */
const AUTOPLAY_MS = 4500;
/** 触摸滑动触发阈值（px） */
const SWIPE_THRESHOLD = 50;

/** 环形槽位：距离 0=中间，1/2=左右各一层（桌面），≥3 藏出视口 */
const CAROUSEL_TRANSITION = { duration: 0.55, ease: [0.4, 0, 0.2, 1] } as const;

type Slot = {
    distance: number;
    side: -1 | 0 | 1;
    visible: boolean;
};

/** 根据环形距离 + 卡片总数计算每张卡的槽位。
 *  距离 = min((idx-active) mod N, N-(idx-active) mod N)，方向取符号。 */
function slotFor(index: number, active: number, total: number): Slot {
    if (total <= 1) return { distance: 0, side: 0, visible: true };
    const forward = (index - active % total + total) % total;
    const backward = total - forward;
    let distance: number;
    let side: -1 | 0 | 1;
    if (forward === 0) {
        distance = 0;
        side = 0;
    } else if (forward <= backward) {
        distance = forward;
        side = 1;
    } else {
        distance = backward;
        side = -1;
    }
    // N=2 时左右只有 1 层；N≥3 桌面保留 2 层
    const maxVisible = total === 2 ? 1 : 2;
    return { distance, side, visible: distance <= maxVisible };
}

/** 按槽位返回 3D 变换。用单一 CSS transform 字符串（motion 不直接支持 rotateY/translateZ）。 */
function slotTransform(slot: Slot, isMobile: boolean) {
    if (slot.distance === 0) {
        return { transform: "translateX(0%) rotateY(0deg) scale(1) translateZ(0px)", opacity: 1, zIndex: 30 };
    }
    if (slot.distance === 1) {
        const scale = isMobile ? 0.6 : 0.82;
        const rotate = isMobile ? 30 : 38;
        const x = isMobile ? 42 : 62;
        return {
            transform: `translateX(${slot.side * x}%) rotateY(${slot.side * -rotate}deg) scale(${scale}) translateZ(-120px)`,
            opacity: 0.55,
            zIndex: 20,
        };
    }
    // distance >= 2（桌面第 2 层）
    return {
        transform: `translateX(${slot.side * 118}%) rotateY(${slot.side * -52}deg) scale(0.66) translateZ(-240px)`,
        opacity: 0.22,
        zIndex: 10,
    };
}

type HeroCarouselProps = {
    items: Prompt[];
    activeIndex: number;
    onIndexChange: (index: number) => void;
};

export const HeroCarousel = forwardRef<HTMLDivElement, HeroCarouselProps>(function HeroCarousel(
    { items, activeIndex, onIndexChange },
    ref,
) {
    const { t } = useTranslation();
    const total = items.length;
    const [isMobile, setIsMobile] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [progress, setProgress] = useState(0);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const attachRef = useCallback(
        (node: HTMLDivElement | null) => {
            containerRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref && "current" in ref) ref.current = node;
        },
        [ref],
    );
    const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const touchStartXRef = useRef<number>(0);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const active = activeIndex % Math.max(total, 1);
    const canAutoplay = total >= 3 && isPlaying && !isHovered;

    // 响应式断点
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 640px)");
        const apply = (e: MediaQueryList | MediaQueryListEvent) => setIsMobile(e.matches);
        apply(mq);
        mq.addEventListener("change", (e) => apply(e));
        return () => mq.removeEventListener("change", (e) => apply(e));
    }, []);

    // prefers-reduced-motion：关闭自动播放
    const reducedMotion = useMemo(() => {
        if (typeof window === "undefined" || !window.matchMedia) return false;
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }, []);

    // 自动播放进度
    useEffect(() => {
        if (reducedMotion) return;
        if (!canAutoplay) {
            setProgress(0);
            return;
        }
        let elapsed = 0;
        const step = 100;
        progressTimerRef.current = setInterval(() => {
            elapsed += step;
            setProgress(elapsed / AUTOPLAY_MS);
            if (elapsed >= AUTOPLAY_MS) {
                onIndexChange(active + 1);
                elapsed = 0;
                setProgress(0);
            }
        }, step);
        return () => {
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        };
    }, [canAutoplay, active, reducedMotion]);

    // 后台标签页：切后台暂停，回来续播
    useEffect(() => {
        const handler = () => setIsPlaying(document.visibilityState === "visible");
        document.addEventListener("visibilitychange", handler);
        return () => document.removeEventListener("visibilitychange", handler);
    }, []);

    // 任何用户操作 → 重置自动计时（从 0 重新倒计时）
    const resetAutoplay = useCallback(() => {
        setProgress(0);
    }, []);

    const goTo = useCallback(
        (target: number) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                onIndexChange(((target % total) + total) % total);
                resetAutoplay();
            }, 0);
        },
        [onIndexChange, total, resetAutoplay],
    );

    const next = useCallback(() => goTo(active + 1), [goTo, active]);
    const prev = useCallback(() => goTo(active - 1), [goTo, active]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") {
                e.preventDefault();
                next();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                prev();
            }
        },
        [next, prev],
    );

    const handleTouchStart = useCallback((e: PointerEvent) => {
        touchStartXRef.current = e.clientX;
        setIsHovered(true);
    }, []);
    const handleTouchEnd = useCallback(
        (e: PointerEvent) => {
            const dx = e.clientX - touchStartXRef.current;
            if (Math.abs(dx) > SWIPE_THRESHOLD) {
                if (dx < 0) next();
                else prev();
            }
            setIsHovered(false);
        },
        [next, prev],
    );

    if (total === 0) return null;

    const slots = items.map((_, idx) => slotFor(idx, active, total));
    const activeItem = items[active];

    return (
        <div
            ref={attachRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onPointerDown={handleTouchStart}
            onPointerUp={handleTouchEnd}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="hero-carousel group relative mx-auto w-full select-none outline-none"
            style={{ perspective: "1300px", touchAction: "pan-y" }}
            role="region"
            aria-label={t("home.heroCarousel.region")}
        >
            <div
                className="relative mx-auto flex h-[280px] w-full items-center justify-center sm:h-[340px] md:h-[400px]"
                style={{ transformStyle: "preserve-3d" }}
            >
                {items.map((item, idx) => {
                    const slot = slots[idx];
                    if (!slot.visible) return null;
                    const tf = slotTransform(slot, isMobile);
                    const isCenter = slot.distance === 0;
                    return (
                        <motion.button
                            key={item.id}
                            type="button"
                            onClick={() => !isCenter && goTo(idx)}
                            className={cn(
                                "hero-card absolute flex h-[190px] w-[150px] flex-col overflow-hidden rounded-2xl border bg-stone-100 text-left shadow-lg sm:h-[240px] sm:w-[190px] md:h-[300px] md:w-[230px]",
                                isCenter
                                    ? "border-white/60 dark:border-white/15"
                                    : slot.distance === 1
                                      ? "border-stone-200/60 dark:border-stone-700/40"
                                      : "border-stone-200/40 dark:border-stone-800/40",
                            )}
                            style={{ zIndex: tf.zIndex }}
                            initial={false}
                            animate={{
                                transform: tf.transform,
                                opacity: tf.opacity,
                            }}
                            transition={CAROUSEL_TRANSITION}
                        >
                            <CardMedia item={item} />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent p-3 text-white">
                                <h3 className="truncate text-sm font-medium">{item.title}</h3>
                                {item.tags.length > 0 && <p className="mt-0.5 truncate text-[11px] text-white/70">{item.tags.slice(0, 2).join(" · ")}</p>}
                            </div>
                            {isCenter && (
                                <span className="pointer-events-none absolute inset-0 rounded-2xl" style={{ boxShadow: "0 0 60px -12px var(--hero-glow)" }} />
                            )}
                        </motion.button>
                    );
                })}
            </div>

            {/* 左右箭头（桌面 + 平板） */}
            {!isMobile && total >= 3 && (
                <>
                    <CarouselArrow direction="prev" onClick={prev} label={t("home.heroCarousel.prev")} />
                    <CarouselArrow direction="next" onClick={next} label={t("home.heroCarousel.next")} />
                </>
            )}

            {/* 底部控制条：进度 + 圆点 */}
            {total >= 2 && (
                <div className="mt-6 flex flex-col items-center gap-3">
                    {!isMobile && (
                        <div className="h-0.5 w-40 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                            <motion.div
                                className="h-full bg-[var(--hero-glow)]"
                                animate={{ width: `${Math.min(progress, 1) * 100}%` }}
                                transition={{ duration: 0.1, ease: "linear" }}
                            />
                        </div>
                    )}
                    <div className="flex items-center gap-2" role="tablist" aria-label={t("home.heroCarousel.dots")}>
                        {items.map((item, idx) => {
                            const isActive = idx === active;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={() => goTo(idx)}
                                    className={cn(
                                        "h-1.5 rounded-full transition-all duration-300",
                                        isActive ? "w-5 bg-[var(--hero-glow)]" : "w-1.5 bg-stone-300 hover:bg-stone-400 dark:bg-stone-700 dark:hover:bg-stone-600",
                                    )}
                                    aria-label={`${t("home.heroCarousel.dots")} ${idx + 1}`}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
});

function CarouselArrow({ direction, onClick, label }: { direction: "prev" | "next"; onClick: () => void; label: string }) {
    const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn(
                "absolute top-1/2 z-40 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-stone-200/70 bg-white/80 text-stone-700 shadow-lg backdrop-blur transition hover:scale-105 hover:bg-white dark:border-stone-700/60 dark:bg-stone-800/80 dark:text-stone-200 dark:hover:bg-stone-800",
                direction === "prev" ? "left-2 md:left-6" : "right-2 md:right-6",
            )}
        >
            <Icon className="size-5" />
        </button>
    );
}

/** 卡片媒体层：图 + 失败/缺图占位 */
function CardMedia({ item }: { item: Prompt }) {
    const [failed, setFailed] = useState(false);
    const hasImage = !!item.coverUrl && !failed;
    return (
        <div className="absolute inset-0">
            {hasImage ? (
                <img src={item.coverUrl} alt={item.title} onError={() => setFailed(true)} className="h-full w-full object-cover" />
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-200 to-stone-400 dark:from-stone-800 dark:to-stone-950">
                    <span className="text-4xl font-bold text-white/40 dark:text-white/25">{item.title.slice(0, 1) || "•"}</span>
                </div>
            )}
        </div>
    );
}

export type { HeroCarouselProps };
export type { Slot };
