import * as TWEEN from "@tweenjs/tween.js";

/**
 * 基于 TWEEN 的动画工具类
 */
export class TweenAnimation<T extends object> {
	private static tweenGroup: TWEEN.Group = new TWEEN.Group();
	private static animationFrameId: number | undefined;
	private static activeTweenCount: number = 0; // 使用计数器避免 getAll().length

	// 复用同一个 tick，避免重复创建闭包
	private static tick = (time: number) => {
		TweenAnimation.tweenGroup.update(time as unknown as number);
		if (TweenAnimation.activeTweenCount > 0) {
			TweenAnimation.animationFrameId = requestAnimationFrame(
				TweenAnimation.tick,
			);
		} else {
			TweenAnimation.animationFrameId = undefined;
		}
	};

	private tween: TWEEN.Tween | undefined;
	private currentObject: T;
	private targetObject: T;
	private easingFunction: typeof TWEEN.Easing.Quadratic.Out;
	private duration: number;
	private onUpdate: (object: T) => void;

	/**
	 * 初始化动画状态
	 * @param defaultObject 初始状态
	 * @param onUpdate 更新状态回调
	 */
	constructor(
		defaultObject: T,
		easingFunction: typeof TWEEN.Easing.Quadratic.Out,
		duration: number,
		onUpdate: (object: T) => void,
	) {
		this.currentObject = defaultObject;
		this.targetObject = defaultObject;
		this.easingFunction = easingFunction;
		this.duration = duration;
		this.onUpdate = onUpdate;
	}

	/**
	 * 更新动画状态
	 * @param object
	 */
	public update = (object: T, ignoreAnimation: boolean = false) => {
		this.targetObject = object;

		if (this.tween) {
			this.tween.stop();
			TweenAnimation.tweenGroup.remove(this.tween);
			TweenAnimation.activeTweenCount--;
			this.tween = undefined;
		}

		// 无需动画：直接同步
		if (ignoreAnimation || this.duration <= 0) {
			this.currentObject = this.targetObject;
			this.onUpdate(this.currentObject);
			return;
		}

		this.tween = new TWEEN.Tween(this.currentObject)
			.to(this.targetObject, this.duration)
			.easing(this.easingFunction)
			.onUpdate(this.handleOnUpdate)
			.onComplete(() => {
				if (this.tween) {
					TweenAnimation.tweenGroup.remove(this.tween);
					TweenAnimation.activeTweenCount--;
					this.tween = undefined;
				}
				// 确保最终态回调发出（即使被节流跳过了最后一帧）
				this.onUpdate(this.targetObject);
			})
			.start();

		TweenAnimation.tweenGroup.add(this.tween);
		TweenAnimation.activeTweenCount++;
		TweenAnimation.startAnimationLoop();
	};

	private static startAnimationLoop = () => {
		if (TweenAnimation.animationFrameId !== undefined) {
			return;
		}

		TweenAnimation.animationFrameId = requestAnimationFrame(
			TweenAnimation.tick,
		);
	};

	private handleOnUpdate = (obj: T) => {
		this.onUpdate(obj);
	};

	public dispose = () => {
		if (this.tween) {
			this.tween.stop();
			TweenAnimation.tweenGroup.remove(this.tween);
			this.tween = undefined;
		}

		// @ts-expect-error - 清理引用
		this.currentObject = undefined;
		// @ts-expect-error - 清理引用
		this.targetObject = undefined;
		// @ts-expect-error - 清理引用
		this.onUpdate = undefined;
		// @ts-expect-error - 清理引用
		this.easingFunction = undefined;
		// @ts-expect-error - 清理引用
		this.duration = undefined;
	};

	public getTargetObject = () => {
		return this.targetObject;
	};

	public isDone = () => {
		return this.tween === undefined;
	};
}
