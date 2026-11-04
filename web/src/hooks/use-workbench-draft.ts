import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";

import type { ReferenceImage } from "@/types/image";

/** 工作台草稿：路由切走（组件卸载）后提示词/参考图仍保留。
 *  仅存内存（模块级 Map），刷新浏览器会清空；不写 localStorage。
 *  生成结果 / 日志等任务态仍留在各页面，不在此保留。 */
type WorkbenchDraft = {
    prompt: string;
    references: ReferenceImage[];
};

const draftCache = new Map<"image" | "video", WorkbenchDraft>();

export function useWorkbenchDraft(scope: "image" | "video"): {
    prompt: string;
    setPrompt: Dispatch<SetStateAction<string>>;
    references: ReferenceImage[];
    setReferences: Dispatch<SetStateAction<ReferenceImage[]>>;
} {
    const initial = draftCache.get(scope);
    const [prompt, setPrompt] = useState<string>(initial?.prompt ?? "");
    const [references, setReferences] = useState<ReferenceImage[]>(initial?.references ?? []);

    // 用 ref 跟踪最新值，避免把 prompt/references 放进 effect deps
    const promptRef = useRef(prompt);
    const referencesRef = useRef(references);
    promptRef.current = prompt;
    referencesRef.current = references;

    useEffect(() => {
        return () => {
            // 组件卸载（切页）时把最新 prompt/references 写回 cache
            draftCache.set(scope, { prompt: promptRef.current, references: referencesRef.current });
        };
    }, [scope]);

    return { prompt, setPrompt, references, setReferences };
}
