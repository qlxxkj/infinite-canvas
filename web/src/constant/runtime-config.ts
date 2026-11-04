// Runtime configuration access layer.
// Priority: window.__RUNTIME_CONFIG__ (injected by the container entrypoint) > build-time VITE_ variables > defaults.
// This supports both configuring the same image with docker run -e and injecting values during custom builds.
//
// Each analytics provider has its own variable; configured providers are enabled independently and all are disabled by default.
// Only GA4 and Baidu are supported. Both accept IDs only, and script URLs are assembled in code without arbitrary scripts or inline JavaScript.

type RuntimeConfig = {
    ANALYTICS_GA4_ID?: string; // GA4 measurement ID (G-XXXX)
    ANALYTICS_BAIDU_ID?: string; // Baidu Analytics site ID
    // 系统默认 Agnes API 渠道：部署方通过环境变量注入，所有用户开箱即用。
    // 留空则不启用（回退到用户自配渠道）。
    AGNES_API_KEY?: string; // Agnes API Key（sk-...）
    AGNES_BASE_URL?: string; // Agnes API 根地址（默认 https://apihub.agnes-ai.com）
    AGNES_IMAGE_MODEL?: string; // 图像模型（默认 agnes-image-2.5-flash）
    AGNES_VIDEO_MODEL?: string; // 视频模型（默认 agnes-video-2.5）
    AGNES_TEXT_MODEL?: string; // 文本模型（默认 agnes-3.0-flash）
    AGNES_CHANNEL_NAME?: string; // 渠道展示名（默认 Agnes 官方）
};

declare global {
    interface Window {
        __RUNTIME_CONFIG__?: RuntimeConfig;
    }
}

const runtime: RuntimeConfig = (typeof window !== "undefined" && window.__RUNTIME_CONFIG__) || {};

function read(key: keyof RuntimeConfig, buildTime: string | undefined, fallback = ""): string {
    const value = runtime[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof buildTime === "string" && buildTime.trim()) return buildTime.trim();
    return fallback;
}

export const ANALYTICS_GA4_ID = read("ANALYTICS_GA4_ID", import.meta.env.VITE_ANALYTICS_GA4_ID);
export const ANALYTICS_BAIDU_ID = read("ANALYTICS_BAIDU_ID", import.meta.env.VITE_ANALYTICS_BAIDU_ID);

// Agnes 系统默认渠道（env 注入）。任一关键值（key 或 baseUrl）非空即启用。
export const AGNES_API_KEY = read("AGNES_API_KEY", import.meta.env.VITE_AGNES_API_KEY);
export const AGNES_BASE_URL = read("AGNES_BASE_URL", import.meta.env.VITE_AGNES_BASE_URL, "https://apihub.agnes-ai.com");
export const AGNES_IMAGE_MODEL = read("AGNES_IMAGE_MODEL", import.meta.env.VITE_AGNES_IMAGE_MODEL, "agnes-image-2.5-flash");
export const AGNES_VIDEO_MODEL = read("AGNES_VIDEO_MODEL", import.meta.env.VITE_AGNES_VIDEO_MODEL, "agnes-video-2.5");
export const AGNES_TEXT_MODEL = read("AGNES_TEXT_MODEL", import.meta.env.VITE_AGNES_TEXT_MODEL, "agnes-3.0-flash");
export const AGNES_CHANNEL_NAME = read("AGNES_CHANNEL_NAME", import.meta.env.VITE_AGNES_CHANNEL_NAME, "Agnes 官方");

/** 系统 Agnes 渠道是否启用（key + baseUrl 齐备）。store 据此注入默认渠道。 */
export const AGNES_CHANNEL_ENABLED = Boolean(AGNES_API_KEY && AGNES_BASE_URL);
