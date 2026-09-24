import type { ReactNode } from "react";

import { AgentPanel } from "@/components/agent/agent-panel";
import { AppTopNav } from "@/components/layout/app-top-nav";

export default function UserLayout({ children }: { children: ReactNode }) {
    return (
        <div className="relative h-dvh overflow-hidden bg-background text-foreground">
            <div className="flex h-full min-w-0 flex-col overflow-hidden">
                {/* 内容区铺满全屏（含导航下方区域），导航栏悬浮在其上方，毛玻璃透出滚动内容 */}
                <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            </div>
            {/* 悬浮导航：外层 pointer-events-none，仅导航本身可交互；内容滚动到导航下方时透过毛玻璃可见 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
                <div className="pointer-events-auto">
                    <AppTopNav />
                </div>
            </div>
            <AgentPanel />
        </div>
    );
}
