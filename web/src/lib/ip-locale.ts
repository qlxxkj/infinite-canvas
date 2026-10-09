/**
 * Detect the visitor's locale from their public IP via a lightweight geolocation
 * service. China → "zh-CN", everything else → "en-US".
 *
 * Multiple providers are tried in order; the first successful response wins.
 * A short timeout keeps the initial page render fast — on total failure the
 * caller's default locale is kept.
 */

export type ResolvedLocale = "zh-CN" | "en-US";

const AUTO_RESOLVE_STORAGE_KEY = "infinite-canvas:locale:auto";

const PROVIDERS: Array<(ip: string) => Promise<string | null>> = [
    // ipwho.is is free, no key, CORS-open, and returns `country` (ISO-3166 alpha-2).
    async (ip) => {
        const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
        if (!res.ok) return null;
        const data: unknown = await res.json();
        const country = (data as { country?: string }).country;
        return country ?? null;
    },
    // Fallback: ip-api.com (free tier, CORS-open, max ~1 req/s).
    async (ip) => {
        const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=countryCode&lang=zh-CN`);
        if (!res.ok) return null;
        const data: unknown = await res.json();
        const code = (data as { countryCode?: string }).countryCode;
        return code ?? null;
    },
];

function timeoutSignal(ms: number): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
}

async function fetchPublicIp(): Promise<string | null> {
    // Any public IP-echo that supports CORS is fine; ipify and cloudflare both do.
    const endpoints = ["https://api.ipify.org?format=text", "https://ifconfig.co/ip", "https://icanhazip.com"];
    for (const url of endpoints) {
        try {
            const res = await fetch(url, { signal: timeoutSignal(4000) });
            if (!res.ok) continue;
            const text = (await res.text()).trim();
            if (/^\d+\.\d+\.\d+\.\d+$/.test(text)) return text;
        } catch {
            // try next
        }
    }
    return null;
}

async function resolveCountryCode(): Promise<string | null> {
    const ip = await fetchPublicIp();
    if (!ip) return null;
    for (const provider of PROVIDERS) {
        try {
            const country = await provider(ip);
            if (country) return country.toUpperCase();
        } catch {
            // try next provider
        }
    }
    return null;
}

/**
 * Detect the locale from the visitor's IP. China (CN) → zh-CN, else → en-US.
 * Returns null when detection fails (caller should keep its default).
 * Results are cached in localStorage so we only hit the network once.
 */
export async function detectLocaleByIp(): Promise<ResolvedLocale | null> {
    if (typeof localStorage !== "undefined") {
        try {
            const cached = localStorage.getItem(AUTO_RESOLVE_STORAGE_KEY);
            if (cached === "zh-CN" || cached === "en-US") return cached;
        } catch {
            // ignore storage errors
        }
    }

    const country = await resolveCountryCode();
    if (!country) return null;

    const locale: ResolvedLocale = country === "CN" ? "zh-CN" : "en-US";
    if (typeof localStorage !== "undefined") {
        try {
            localStorage.setItem(AUTO_RESOLVE_STORAGE_KEY, locale);
        } catch {
            // ignore
        }
    }
    return locale;
}

export function hasAutoResolvedLocale(): boolean {
    if (typeof localStorage === "undefined") return false;
    try {
        const v = localStorage.getItem(AUTO_RESOLVE_STORAGE_KEY);
        return v === "zh-CN" || v === "en-US";
    } catch {
        return false;
    }
}
