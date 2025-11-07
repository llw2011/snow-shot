import type { ExcalidrawActionType } from "@mg-chao/excalidraw/types";
import type * as PIXI from "pixi.js";

/**
 * 操作类型枚举
 */
enum CanvasHistoryActionType {
	Add = 0,
	Remove = 1,
	DrawCacheRedo = 11,
	DrawCacheUndo = 12,
	DrawCacheRecord = 13,
	DrawCacheClear = 14,
}

/**
 * 历史操作接口
 */
type CanvasHistoryAction =
	| {
			type: CanvasHistoryActionType.Add;
			container: PIXI.Container;
			object: PIXI.Container;
	  }
	| {
			type: CanvasHistoryActionType.Remove;
			container: PIXI.Container;
			object: PIXI.Container;
	  }
	| {
			type: CanvasHistoryActionType.DrawCacheRecord;
			excalidrawActionRef: React.RefObject<ExcalidrawActionType | undefined>;
	  };

export class CanvasHistory {
	private undoStack: CanvasHistoryAction[] = [];
	private redoStack: CanvasHistoryAction[] = [];
	private onUpdateListener: Set<() => void> = new Set();

	public addOnUpdateListener(listener: () => void): () => void {
		this.onUpdateListener.add(listener);

		return () => {
			this.onUpdateListener.delete(listener);
		};
	}

	private onUpdate(): void {
		this.onUpdateListener.forEach((listener) => {
			listener();
		});
	}

	/**
	 * 将操作添加到历史栈
	 * @param action 历史操作对象
	 */
	private pushAction(action: CanvasHistoryAction): void {
		this.undoStack.push(action);
		// 有新的操作，清空重做栈
		this.redoStack = [];

		this.onUpdateListener.forEach((listener) => {
			listener();
		});
	}

	public pushAddAction(
		container: PIXI.Container,
		object: PIXI.Container,
	): void {
		this.pushAction({
			type: CanvasHistoryActionType.Add,
			container,
			object,
		});
	}

	public pushRemoveAction(
		container: PIXI.Container,
		object: PIXI.Container,
	): void {
		this.pushAction({
			type: CanvasHistoryActionType.Remove,
			container,
			object,
		});
	}

	/**
	 * 添加绘图缓存记录操作
	 * @param history Excalidraw历史记录对象
	 */
	public pushDrawCacheRecordAction(
		actionRef: React.RefObject<ExcalidrawActionType | undefined>,
	): void {
		this.pushAction({
			type: CanvasHistoryActionType.DrawCacheRecord,
			excalidrawActionRef: actionRef,
		});
	}

	/**
	 * 检查是否可以执行撤销操作
	 * @returns {boolean} 如果有可撤销的操作返回 true，否则返回 false
	 */
	public canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	/**
	 * 检查是否可以执行重做操作
	 * @returns {boolean} 如果有可重做的操作返回 true，否则返回 false
	 */
	public canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	/**
	 * 撤销操作
	 */
	public undo(): void {
		if (!this.canUndo()) return;

		const action = this.undoStack.pop();
		if (!action) return;

		switch (action.type) {
			case CanvasHistoryActionType.Add:
				action.container.removeChild(action.object);
				break;
			case CanvasHistoryActionType.Remove:
				action.container.addChild(action.object);
				break;
			case CanvasHistoryActionType.DrawCacheRecord:
				action.excalidrawActionRef.current?.historyUndo();
				break;
		}

		this.redoStack.push(action);
		this.onUpdate();
	}

	/**
	 * 重做操作
	 */
	public redo(): void {
		if (!this.canRedo()) return;

		const action = this.redoStack.pop();
		if (!action) return;

		switch (action.type) {
			case CanvasHistoryActionType.Add:
				action.container.addChild(action.object);
				break;
			case CanvasHistoryActionType.Remove:
				action.container.removeChild(action.object);
				break;
			case CanvasHistoryActionType.DrawCacheRecord:
				action.excalidrawActionRef.current?.historyRedo();
				break;
		}

		this.undoStack.push(action);
		this.onUpdate();
	}

	/**
	 * 清空历史记录
	 */
	public clear(): void {
		this.undoStack = [];
		this.redoStack = [];

		this.onUpdate();
	}

	/**
	 * 获取可撤销操作数量
	 */
	public get undoLength(): number {
		return this.undoStack.length;
	}

	/**
	 * 获取可重做操作数量
	 */
	public get redoLength(): number {
		return this.redoStack.length;
	}
}
