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

/** 按槽位返回 3D 变换（对齐参考 hero__card：scale 与 opacity 逐层匹配）。
 *  中心 0；左右 1 层 scale(.873) opacity .8（向中心靠拢，盖住中心卡边缘）；
 *  左右 2 层 scale(.783) opacity .4（与第 1 层留间隙，最外侧淡出）；更远的藏出视口。 */
function slotTransform(slot: Slot, isMobile: boolean) {
    // 桌面中心卡 356px（对齐参考 hero__card），第1层 0.873、第2层 0.783；手机 210px
    const cardW = isMobile ? 210 : 356;
    // 第 1 层：间隙 0 → 向中心靠拢，侧卡盖住中心卡边缘（参考 356 卡时中心距 303.5px）
    const gap1 = 0;
    const scale1 = isMobile ? 0.68 : 0.873;
    const w1 = cardW * scale1;
    const x1 = ((cardW + gap1 + w1) / 2) / cardW * 100;
    // 第 2 层：与第 1 层留 24px 间隙（参考 356 卡时中心距 629.5px ≈ 303.5 + 24 + 302）
    const scale2 = isMobile ? 0.6 : 0.783;
    const w2 = cardW * scale2;
    const gap2 = isMobile ? 10 : 24;
    const x2 = x1 + ((w1 + gap2 + w2) / 2) / cardW * 100;
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
    // distance >= 2（第 2 层，与第 1 层留间隙，最外侧淡出）
    const off2 = (slot.side * x2).toFixed(1);
    return {
        transform: `translateX(${off2}%) scale(${scale2}) translateZ(-240px)`,
        opacity: isMobile ? 0.5 : 0.4,
        zIndex: 10,
    };
}

type HeroCarouselProps = {
    items: Prompt[];
    activeIndex: number;
    onIndexChange: (index: number) => void;
    /** 卡片媒体：传入视频 src（按卡索引轮换），缺省用 item.coverUrl 图片 */
    cardVideos?: string[];
};

export const HeroCarousel = forwardRef<HTMLDivElement, HeroCarouselProps>(function HeroCarousel(
    { items, activeIndex, onIndexChange, cardVideos },
    ref,
) {
    const { t } = useTranslation();
    const total = items.length;
    const [isMobile, setIsMobile] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);

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

    // 自动播放计时：到点自动前进；hover/暂停时归零
    useEffect(() => {
        if (reducedMotion) return;
        if (!canAutoplay) return;
        let elapsed = 0;
        const step = 100;
        progressTimerRef.current = setInterval(() => {
            elapsed += step;
            if (elapsed >= AUTOPLAY_MS) {
                onIndexChange(active + 1);
                elapsed = 0;
            }
        }, step);
        return () => {
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        };
    }, [canAutoplay, active, reducedMotion, onIndexChange]);

    // 后台标签页：切后台暂停，回来续播
    useEffect(() => {
        const handler = () => setIsPlaying(document.visibilityState === "visible");
        document.addEventListener("visibilitychange", handler);
        return () => document.removeEventListener("visibilitychange", handler);
    }, []);

    // 任何用户操作 → 重置自动计时（从 0 重新倒计时）
    const resetAutoplay = useCallback(() => {}, []);

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
            <div className="relative mx-auto flex h-[300px] w-full items-center justify-center sm:h-[380px] md:h-[445px]">
                {items.map((item, idx) => {
                    const slot = slots[idx];
                    if (!slot.visible) return null;
                    const tf = slotTransform(slot, isMobile);
                    const isCenter = slot.distance === 0;
                    return (
                        <motion.div
                            key={item.id}
                            className={cn(
                                "hero-card absolute flex h-[260px] w-[210px] flex-col rounded-[20px] bg-black text-left sm:h-[340px] sm:w-[280px] md:h-[445px] md:w-[356px]",
                                isCenter ? "center-glow cursor-default shadow-2xl" : "cursor-pointer",
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
                            {/* 蓝光晕层垫在卡片后面（z-0，卡片内容 z-10 自带 overflow-hidden 保持圆角裁切），光晕本身向卡片外渗出 */}
                            {isCenter && <span className="hero-card-glow z-0" />}
                            {/* 对齐参考 hero__card：卡片只放媒体（img/video 铺满），标题/prompt 展示在底部 overlay */}
                            <div className="relative z-10 h-full w-full overflow-hidden rounded-[20px]">
                                <CardMedia item={item} videoSrc={cardVideos?.[idx % cardVideos.length]} />
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
});

/** 卡片媒体层：优先视频（按卡轮换），视频加载失败/缺视频回退到图片 */
function CardMedia({ item, videoSrc }: { item: Prompt; videoSrc?: string }) {
    const [videoFailed, setVideoFailed] = useState(false);
    const [imgFailed, setImgFailed] = useState(false);
    const hasVideo = !!videoSrc && !videoFailed;
    const hasImage = !!item.coverUrl && !imgFailed;
    return (
        <div className="absolute inset-0 overflow-hidden rounded-[20px]">
            {hasVideo ? (
                <video
                    src={videoSrc}
                    poster={item.coverUrl}
                    muted
                    loop
                    playsInline
                    autoPlay
                    onError={() => setVideoFailed(true)}
                    className="h-full w-full object-cover"
                />
            ) : hasImage ? (
                <img src={item.coverUrl} alt={item.title} onError={() => setImgFailed(true)} className="h-full w-full object-cover" />
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

/** 胶囊切换按钮组件（对齐参考 carousel-nav：#212226 底 + 42x36 双 chevron 按钮，hover 白底黑字） */
export function HeroCarouselNav({ onPrev, onNext, prevLabel, nextLabel, visible }: { onPrev: () => void; onNext: () => void; prevLabel: string; nextLabel: string; visible: boolean }) {
    if (!visible) return null;
    return (
        <div className="hero-carousel-nav relative z-50">
            <button type="button" onClick={onPrev} aria-label={prevLabel} className="hero-carousel-nav__btn">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
            </button>
            <button type="button" onClick={onNext} aria-label={nextLabel} className="hero-carousel-nav__btn">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
            </button>
        </div>
    );
}
