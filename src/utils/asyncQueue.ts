/** 表示一个异步队列 */
export class AsyncQueue {

	/** 存储第一个函数 */
	private _firstNode?: { value: () => any, next?: AsyncQueue["_firstNode"] }

	/** 存储最后一个函数 */
	private _lastNode?: AsyncQueue["_firstNode"]

	/**
	 * 串行执行一个异步函数
	 * @param func 待执行的函数
	 */
	async run(func: () => any) {
		if (this._lastNode) {
			this._lastNode = this._lastNode.next = { value: func }
		} else {
			this._firstNode = this._lastNode = { value: func }
			try {
				await func()
			} finally {
				this._next()
			}
		}
	}

	/** 执行队列中的下一个任务 */
	private _next = async () => {
		const topNode = this._firstNode = this._firstNode!.next
		if (!topNode) {
			this._lastNode = undefined
			return
		}
		try {
			await topNode.value()
		} finally {
			this._next()
		}
	}

	/** 判断当前队列是否为空 */
	get isEmpty() { return !this._firstNode }

	/** 获取当前所有待执行任务的确认对象 */
	promise() {
		return new Promise(resolve => this.run(resolve))
	}

	/**
	 * 串行执行一个异步函数并返回一个确认对象
	 * @param func 待执行的函数
	 */
	runPromise<T>(func: () => T | Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			this.run(async () => {
				try {
					resolve(await func())
				} catch (e) {
					reject(e)
				}
			})
		})
	}

}