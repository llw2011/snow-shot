import { createLazyFileRoute } from "@tanstack/react-router";
import { ChatPage } from "@/pages/tools/chat/page";

export const Route = createLazyFileRoute("/_layout/tools/chat")({
	component: ChatComponent,
});

function ChatComponent() {
	return <ChatPage />;
}
