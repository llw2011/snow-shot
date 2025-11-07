import { createPublisher } from "@/hooks/useStatePublisher";

export const EnableKeyEventPublisher = createPublisher<boolean>(false);
