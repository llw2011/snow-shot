export type ChatDraftSnapshot = {
	activeSession?: string;
	handledRequest?: string;
	drafts: Record<string, string>;
};

type DraftStorage = {
	read: () => Promise<unknown>;
	write: (snapshot: ChatDraftSnapshot) => Promise<void>;
};

export type ConsumedChatDraft = { session?: string; text: string };

const readSnapshot = (value: unknown): ChatDraftSnapshot => {
	if (!value || typeof value !== "object") {
		return { drafts: {} };
	}
	const { activeSession, handledRequest, drafts } =
		value as Partial<ChatDraftSnapshot>;
	return {
		activeSession:
			typeof activeSession === "string" ? activeSession : undefined,
		handledRequest:
			typeof handledRequest === "string" ? handledRequest : undefined,
		drafts: Object.fromEntries(
			Object.entries(drafts && typeof drafts === "object" ? drafts : {}).filter(
				(entry): entry is [string, string] => typeof entry[1] === "string",
			),
		),
	};
};

/** Drafts stay in memory when storage fails; pending edits survive a slow read. */
export class ChatDrafts {
	snapshot: ChatDraftSnapshot = { drafts: {} };
	private initialized = false;
	private initialization?: Promise<void>;
	private pendingEdits: ((snapshot: ChatDraftSnapshot) => void)[] = [];
	private pendingWrite?: ChatDraftSnapshot;
	private writing?: Promise<void>;

	constructor(
		private storage: DraftStorage,
		private onError: (error: unknown) => void,
	) {}

	init() {
		this.initialization ??= (async () => {
			let loaded: ChatDraftSnapshot;
			try {
				loaded = readSnapshot(await this.storage.read());
			} catch (error) {
				this.onError(error);
				return;
			}
			for (const edit of this.pendingEdits) {
				edit(loaded);
			}
			this.snapshot = loaded;
			this.initialized = true;
			if (this.pendingEdits.length > 0) {
				this.persist();
			}
			this.pendingEdits = [];
		})().finally(() => {
			if (!this.initialized) {
				this.initialization = undefined;
			}
		});
		return this.initialization;
	}

	text(session = this.snapshot.activeSession) {
		return this.snapshot.drafts[session ?? ""] ?? "";
	}

	select(session?: string) {
		if (this.snapshot.activeSession === session) {
			return;
		}
		this.change((snapshot) => {
			snapshot.activeSession = session;
		});
	}

	createSession(session: string) {
		this.change((snapshot) => {
			if (snapshot.activeSession === undefined && snapshot.drafts[""]) {
				snapshot.drafts[session] = snapshot.drafts[""];
				delete snapshot.drafts[""];
			}
			snapshot.activeSession = session;
		});
	}

	set(text: string, session = this.snapshot.activeSession) {
		this.change((snapshot) => {
			snapshot.activeSession = session;
			if (text) {
				snapshot.drafts[session ?? ""] = text;
			} else {
				delete snapshot.drafts[session ?? ""];
			}
		});
	}

	consume({ session, text }: ConsumedChatDraft) {
		this.change((snapshot) => {
			const key = session ?? "";
			if (snapshot.drafts[key] === text) {
				delete snapshot.drafts[key];
			}
		});
	}

	claimRequest(sign: string) {
		if (this.snapshot.handledRequest === sign) {
			return false;
		}
		this.change((snapshot) => {
			snapshot.handledRequest = sign;
		});
		return true;
	}

	clear() {
		this.change((snapshot) => {
			snapshot.activeSession = undefined;
			snapshot.drafts = {};
		});
	}

	private change(edit: (snapshot: ChatDraftSnapshot) => void) {
		edit(this.snapshot);
		if (!this.initialized) {
			this.pendingEdits.push(edit);
			void this.init();
			return;
		}
		this.persist();
	}

	private persist() {
		this.pendingWrite = {
			...this.snapshot,
			drafts: { ...this.snapshot.drafts },
		};
		this.writing ??= Promise.resolve().then(async () => {
			while (this.pendingWrite) {
				const snapshot = this.pendingWrite;
				this.pendingWrite = undefined;
				try {
					await this.storage.write(snapshot);
				} catch (error) {
					this.onError(error);
				}
			}
			this.writing = undefined;
		});
	}

	async flush() {
		await this.initialization;
		await this.writing;
	}
}
