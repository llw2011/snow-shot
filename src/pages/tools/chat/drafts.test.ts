import { type ChatDraftSnapshot, ChatDrafts } from "./drafts.js";

const assert = (condition: boolean, message: string) => {
	if (!condition) {
		throw new Error(message);
	}
};

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

const memoryStorage = (initial?: ChatDraftSnapshot) => {
	let saved = initial;
	return {
		read: async () => saved,
		write: async (snapshot: ChatDraftSnapshot) => {
			saved = structuredClone(snapshot);
		},
	};
};

const unexpectedError = (error: unknown) => {
	throw error;
};

// Reload and soft navigation restore both the current conversation and its draft.
{
	const storage = memoryStorage();
	const first = new ChatDrafts(storage, unexpectedError);
	await first.init();
	first.set("unfinished new conversation");
	first.select("session-a");
	first.set("draft A");
	first.select("session-b");
	first.set("draft B");
	await first.flush();
	const restored = new ChatDrafts(storage, unexpectedError);
	await restored.init();
	assert(
		restored.snapshot.activeSession === "session-b",
		"restore current session",
	);
	assert(restored.text() === "draft B", "restore current draft");
	restored.select("session-a");
	assert(
		restored.text() === "draft A",
		"switching sessions restores their own drafts",
	);
	restored.select();
	assert(
		restored.text() === "unfinished new conversation",
		"keep the new-session draft",
	);
}

// Local input/selection while native storage reads wins without dropping other drafts.
{
	const pending = deferred<ChatDraftSnapshot>();
	const storage = memoryStorage();
	const drafts = new ChatDrafts(
		{ ...storage, read: () => pending.promise },
		unexpectedError,
	);
	const initialized = drafts.init();
	drafts.set("typed while loading");
	pending.resolve({
		activeSession: "old",
		drafts: { old: "old draft", other: "other draft" },
	});
	await initialized;
	assert(
		drafts.snapshot.activeSession === undefined,
		"new input keeps its new-session identity",
	);
	assert(
		drafts.text() === "typed while loading",
		"slow storage does not overwrite input",
	);
	assert(
		drafts.text("other") === "other draft",
		"slow storage retains untouched drafts",
	);
	await drafts.flush();
}

// A successful send or enqueue consumes only the input it actually accepted.
{
	const drafts = new ChatDrafts(memoryStorage(), unexpectedError);
	await drafts.init();
	drafts.set("first message");
	const firstMessage: { session?: string; text: string } = {
		session: undefined,
		text: drafts.text(),
	};
	drafts.createSession("created-session");
	firstMessage.session = "created-session";
	drafts.consume(firstMessage);
	assert(drafts.text() === "", "sending clears the promoted first draft");
	drafts.select();
	assert(
		drafts.text() === "",
		"sending the first message clears the temporary draft",
	);
	drafts.select("created-session");
	drafts.set("queued message");
	const queued = { session: "created-session", text: drafts.text() };
	drafts.consume(queued);
	assert(drafts.text() === "", "enqueue clears the accepted input");
	drafts.set("next draft while the queue runs");
	drafts.consume(queued);
	assert(
		drafts.text() === "next draft while the queue runs",
		"late queued completion cannot clear new text",
	);
	drafts.select("other-session");
	drafts.set("other session draft");
	drafts.consume({
		session: "created-session",
		text: "next draft while the queue runs",
	});
	assert(
		drafts.text() === "other session draft",
		"completion cannot clear another session",
	);
}

// Text entered while the first session is being created follows the new session.
{
	const drafts = new ChatDrafts(memoryStorage(), unexpectedError);
	await drafts.init();
	drafts.set("submitted text");
	const capturedText = drafts.text();
	drafts.set("new text during session creation");
	drafts.createSession("first-session");
	drafts.consume({ session: "first-session", text: capturedText });
	assert(
		drafts.text() === "new text during session creation",
		"first send cannot hide or consume input typed during session creation",
	);
	drafts.select();
	assert(
		drafts.text() === "",
		"promotion leaves no unreachable temporary draft",
	);
}

// Clear during initialization prevents deleted drafts from reappearing.
{
	const pending = deferred<ChatDraftSnapshot>();
	const storage = memoryStorage();
	const drafts = new ChatDrafts(
		{ ...storage, read: () => pending.promise },
		unexpectedError,
	);
	const initialized = drafts.init();
	drafts.clear();
	pending.resolve({ activeSession: "old", drafts: { old: "deleted" } });
	await initialized;
	await drafts.flush();
	assert(
		Object.keys(drafts.snapshot.drafts).length === 0,
		"clear wins over a pending read",
	);
	const restored = new ChatDrafts(storage, unexpectedError);
	await restored.init();
	assert(restored.text() === "", "clear survives reload");
}

// A stale in-flight write cannot overwrite the newer input or a clear.
{
	const pending = deferred<void>();
	let firstWrite = true;
	let saved: ChatDraftSnapshot | undefined;
	const drafts = new ChatDrafts(
		{
			read: async () => undefined,
			write: async (snapshot) => {
				if (firstWrite) {
					firstWrite = false;
					await pending.promise;
				}
				saved = snapshot;
			},
		},
		unexpectedError,
	);
	await drafts.init();
	drafts.set("first");
	await Promise.resolve();
	drafts.set("second");
	drafts.clear();
	pending.resolve();
	await drafts.flush();
	assert(
		saved !== undefined && Object.keys(saved.drafts).length === 0,
		"writes stay ordered through clear",
	);
}

// A previously applied selected-text URL must not replace an edited draft on reload.
{
	const storage = memoryStorage();
	const drafts = new ChatDrafts(storage, unexpectedError);
	await drafts.init();
	assert(
		drafts.claimRequest("selection-1"),
		"accept a new selected-text request",
	);
	drafts.set("edited selection draft");
	await drafts.flush();
	const restored = new ChatDrafts(storage, unexpectedError);
	await restored.init();
	assert(
		!restored.claimRequest("selection-1"),
		"do not reapply a selected-text URL after reload",
	);
	assert(
		restored.text() === "edited selection draft",
		"keep edits to selected text",
	);
	assert(
		restored.claimRequest("selection-2"),
		"accept a later selected-text request",
	);
}

// A failed read cannot overwrite unknown disk state; later edits merge after retry.
{
	const errors: unknown[] = [];
	let failRead = true;
	let failWrite = true;
	let writeAttempts = 0;
	let saved: ChatDraftSnapshot = {
		activeSession: "existing",
		drafts: { existing: "keep existing draft", other: "keep other draft" },
	};
	const drafts = new ChatDrafts(
		{
			read: async () => {
				if (failRead) throw new Error("read failed");
				return saved;
			},
			write: async (snapshot) => {
				writeAttempts++;
				if (failWrite) throw new Error("write failed");
				saved = snapshot;
			},
		},
		(error) => {
			errors.push(error);
		},
	);
	await drafts.init();
	drafts.select();
	await drafts.flush();
	assert(
		writeAttempts === 0,
		"a failed read and restore cannot trigger a write",
	);
	assert(
		saved.drafts.other === "keep other draft",
		"failed initialization leaves saved drafts untouched",
	);
	failRead = false;
	drafts.set("kept in memory");
	await drafts.flush();
	assert(
		drafts.text() === "kept in memory",
		"storage failures do not discard input",
	);
	assert(errors.length === 2, "read and write errors are reported");
	failWrite = false;
	drafts.set("saved after recovery");
	await drafts.flush();
	assert(
		saved.drafts[""] === "saved after recovery",
		"failed writes do not poison later saves",
	);
	assert(
		saved.drafts.existing === "keep existing draft" &&
			saved.drafts.other === "keep other draft",
		"successful retry preserves drafts in other sessions",
	);
}

console.log("Chat draft regression checks passed (8 scenarios).");
