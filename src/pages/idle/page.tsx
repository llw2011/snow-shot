"use client";

import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { useIdlePage } from "@/components/idlePageCore";

/// 热加载待机页面，当收到启动命令时自动切换到功能页面
export const IdlePage: React.FC = () => {
	const router = useRouter();

	useIdlePage(
		true,
		useCallback(
			(url) => {
				router.navigate({ to: url });
			},
			[router],
		),
	);

	return undefined;
};
