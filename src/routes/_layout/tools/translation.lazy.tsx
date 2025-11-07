import { createLazyFileRoute } from "@tanstack/react-router";
import { TranslationPage } from "@/pages/tools/translation/page";

export const Route = createLazyFileRoute("/_layout/tools/translation")({
	component: TranslationComponent,
});

function TranslationComponent() {
	return <TranslationPage />;
}
