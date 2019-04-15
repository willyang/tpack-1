/** 表示一个异步队列 */
export class AsyncQueue {

	/** 存储第一个函数 */
	private _firstNode?: {
		func: () => any
		resolve: (value: any) => void
		reject: (reason: any) => void
		next?: AsyncQueue["_firstNode"]
	}

	/** 存储最后一个函数 */
	private _lastNode?: AsyncQueue["_firstNode"]

	/** 判断当前队列是否为空 */
	get isEmpty() { return !this._firstNode }

	/**
	 * 串行执行一个异步函数
	 * @param func 待执行的函数
	 * @returns 返回一个表示当前函数已执行完成的确认对象
	 */
	then<T>(func: () => T | Promise<T>) {
		return new Promise<T>((resolve, reject) => {
			const nextNode = { func, resolve, reject }
			if (this._lastNode) {
				this._lastNode = this._lastNode.next = nextNode
			} else {
				this._firstNode = this._lastNode = nextNode
				this._next()
			}
		})
	}

	/** 执行队列中的下一个任务 */
	private _next = async () => {
		const firstNode = this._firstNode!
		try {
			firstNode.resolve(await firstNode.func())
		} catch (e) {
			firstNode.reject(e)
		} finally {
			const nextNode = this._firstNode = firstNode.next
			if (nextNode) {
				this._next()
			} else {
				this._lastNode = undefined
			}
		}
	}

}