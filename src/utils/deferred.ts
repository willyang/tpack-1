/** 表示一个延时等待对象，用于等待多个异步任务 */
export class Deferred implements PromiseLike<any> {

	/** 所有等待异步任务完成后的回调函数 */
	private readonly _callbacks: ((value: any) => any)[] = []

	/** 获取正在执行的异步任务数 */
	rejectCount = 0

	/** 
	 * 添加所有异步任务执行完成后的回调函数
	 * @param callback 要执行的回调函数
	 */
	then(callback: (value: any) => any) {
		if (this.rejectCount) {
			this._callbacks.push(callback)
		} else {
			process.nextTick(callback)
		}
		return this
	}

	/** 记录即将执行一个异步任务 */
	reject() {
		this.rejectCount++
	}

	/** 记录异步任务已结束 */
	resolve() {
		this.rejectCount--
		while (this.rejectCount === 0) {
			const callback = this._callbacks.shift()
			if (callback) {
				callback(undefined)
			} else {
				break
			}
		}
	}

}