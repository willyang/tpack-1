/** 表示一个异步队列 */
export class AsyncQueue extends Array<() => void> {

	/** 正在等待的任务数 */
	private _pending = 0

	/**
	 * 添加一个待执行的函数
	 * @param func 待执行的函数
	 */
	then(func: () => void) {
		if (this._pending++ === 0) {
			func()
		} else {
			this.push(func)
		}
		return this
	}

	/**
	 * 执行行队列中的下一项
	 */
	next() {
		this._pending--
		const func = this.shift()
		if (func) {
			func()
		}
	}

}