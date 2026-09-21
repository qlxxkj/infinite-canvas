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

/** 按槽位返回 3D 变换。位移按「缩放后实际宽度 + 层间显式间隙」计算，
 *  确保相邻层不叠压：中心卡两侧留 gap，第 1 层与第 2 层之间也留 gap。 */
function slotTransform(slot: Slot, isMobile: boolean) {
    // 桌面中心卡 380px、第1层 332px(0.873)、第2层 298px(0.783)；手机 210/143/126
    const cardW = isMobile ? 210 : 380;
    const gap = isMobile ? 10 : 36; // 相邻卡之间保留的间隙
    const scale1 = isMobile ? 0.68 : 0.873;
    const scale2 = isMobile ? 0.6 : 0.783;
    const w1 = cardW * scale1;
    const w2 = cardW * scale2;
    // 中心卡中心到第1层卡中心的距离 = 中心半宽 + gap + 第1层半宽
    const x1 = ((cardW + gap + w1) / 2) / cardW * 100;
    // 第1层中心到第2层中心的距离 = 第1层半宽 + gap + 第2层半宽（桌面收 0.9 倍，避免总宽超出视口）
    const step2 = ((w1 + gap + w2) / 2) / cardW * 100 * (isMobile ? 1 : 0.9);
    if (slot.distance === 0) {
        return { transform: "translateX(0%) scale(1) translateZ(0px)", opacity: 1, zIndex: 30 };
    }
    if (slot.distance === 1) {
        const off = (slot.side * x1).toFixed(1);
        return {
            transform: `translateX(${off}%) scale(${scale1}) translateZ(-120px)`,
            opacity: 0.8,
            zIndex: 20,
        };
    }
    // distance >= 2（桌面第 2 层，最外侧淡出）
    const off2 = (slot.side * (x1 + step2)).toFixed(1);
    return {
        transform: `translateX(${off2}%) scale(${scale2}) translateZ(-240px)`,
        opacity: isMobile ? 0.5 : 0.25,
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
            <div className="relative mx-auto flex h-[340px] w-full items-center justify-center sm:h-[420px] md:h-[560px]">
                {items.map((item, idx) => {
                    const slot = slots[idx];
                    if (!slot.visible) return null;
                    const tf = slotTransform(slot, isMobile);
                    const isCenter = slot.distance === 0;
                    return (
                        <motion.div
                            key={item.id}
                            className={cn(
                                "hero-card absolute flex h-[260px] w-[210px] flex-col overflow-hidden rounded-3xl bg-stone-100 text-left sm:h-[340px] sm:w-[280px] md:h-[460px] md:w-[380px]",
                                isCenter ? "cursor-default shadow-2xl" : "cursor-pointer",
                            )}
                            style={{ zIndex: tf.zIndex }}
                            initial={false}
                            animate={{
                                transform: tf.transform,
                                opacity: tf.opacity,
                            }}
                            transition={CAROUSEL_TRANSITION}
                            onClick={() => !isCenter && goTo(idx)}
                            role={isCenter ? undefined : "button"}
                            tabIndex={isCenter ? undefined : 0}
                            onKeyDown={(e) => {
                                if (!isCenter && (e.key === "Enter" || e.key === " ")) {
                                    e.preventDefault();
                                    goTo(idx);
                                }
                            }}
                        >
                            <CardMedia item={item} />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-white">
                                <h3 className="truncate text-base font-medium sm:text-lg">{item.title}</h3>
                                {item.tags.length > 0 && <p className="mt-1 truncate text-xs text-white/70 sm:text-sm">{item.tags.slice(0, 2).join(" · ")}</p>}
                            </div>
                            {isCenter && <span className="pointer-events-none absolute inset-0 rounded-3xl hero-card-glow" />}
                        </motion.div>
                    );
                })}
            </div>

            {/* 底部控制：左右切换按钮（放在提示词输入框下方，由父级布局） */}
            {!isMobile && total >= 3 && <CarouselArrows onPrev={prev} onNext={next} prevLabel={t("home.heroCarousel.prev")} nextLabel={t("home.heroCarousel.next")} />}
        </div>
    );
});

/** 左右切换按钮（胶囊样式，水平成对放在提示词输入框下方，对齐参考） */
export function CarouselArrows({ onPrev, onNext, prevLabel, nextLabel }: { onPrev: () => void; onNext: () => void; prevLabel: string; nextLabel: string }) {
    const baseBtn =
        "flex h-9 w-12 items-center justify-center rounded-full border border-stone-300/50 bg-white/80 text-stone-700 shadow-md backdrop-blur transition hover:bg-white dark:border-stone-700/50 dark:bg-stone-800/80 dark:text-stone-200 dark:hover:bg-stone-800";
    return (
        <div className="mt-10 flex items-center justify-center gap-2 rounded-2xl border border-stone-300/40 bg-stone-100/80 p-1.5 backdrop-blur dark:border-stone-700/40 dark:bg-stone-900/80">
            <button type="button" onClick={onPrev} aria-label={prevLabel} className={baseBtn}>
                <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={onNext} aria-label={nextLabel} className={baseBtn}>
                <ChevronRight className="size-5" />
            </button>
        </div>
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
