import { lazy, Suspense } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";

import { AnalyticsTracker } from "@/components/layout/analytics-tracker";
import UserLayout from "@/layouts/user-layout";
import HomePage from "@/pages/home";

/** 非首页路由走 lazy chunk，首屏（首页）不背这些页面的包 */
const ImagePage = lazy(() => import("@/pages/image"));
const VideoPage = lazy(() => import("@/pages/video"));
const AssetsPage = lazy(() => import("@/pages/assets"));
const PromptsPage = lazy(() => import("@/pages/prompts"));
const CanvasPage = lazy(() => import("@/pages/canvas"));
const CanvasProjectPage = lazy(() => import("@/pages/canvas/project"));
const ConfigPage = lazy(() => import("@/pages/config"));
const NotFound = lazy(() => import("@/pages/not-found"));

function LazyRoute() {
    return (
        <Suspense fallback={<div className="flex h-full items-center justify-center bg-background text-sm text-stone-400">Loading…</div>}>
            <Outlet />
        </Suspense>
    );
}

export const router = createBrowserRouter([
    {
        element: (
            <UserLayout>
                <AnalyticsTracker />
                <Outlet />
            </UserLayout>
        ),
        children: [
            { path: "/", element: <HomePage /> },
            {
                element: <LazyRoute />,
                children: [
                    { path: "/image", element: <ImagePage /> },
                    { path: "/video", element: <VideoPage /> },
                    { path: "/assets", element: <AssetsPage /> },
                    { path: "/prompts", element: <PromptsPage /> },
                    { path: "/canvas", element: <CanvasPage /> },
                    { path: "/canvas/:id", element: <CanvasProjectPage /> },
                    { path: "/config", element: <ConfigPage /> },
                ],
            },
        ],
    },
    { path: "*", element: <NotFound /> },
]);
