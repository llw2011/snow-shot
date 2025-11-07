export type ListenKeyDownEvent = {
	key: number;
	key_text: string;
};

export type ListenKeyUpEvent = {
	key: number;
	key_text: string;
};

export enum ListenKeyCode {
	LControl = 58,
	RControl = 59,
	LShift = 60,
	RShift = 61,
	LAlt = 62,
	RAlt = 63,
	Command = 64,
	RCommand = 65,
	LOption = 66,
	ROption = 67,
	LMeta = 68,
	RMeta = 69,
}
