/** 表示一个延时对象 */
export class Deferred {

	/** 获取当前关联的确认对象 */
	promise?: Promise<void>

	/** 关联的确认对象解析函数 */
	private _promiseResolve?: () => void

	/** 获取阻止的次数，当次数为 0 时说明未阻止 */
	rejectCount = 0

	/** 阻止后续异步操作 */
	reject() {
		if (this.rejectCount++ === 0) {
			this.promise = new Promise(resolve => {
				this._promiseResolve = resolve
			})
		}
	}

	/** 恢复后续异步操作 */
	resolve() {
		if (--this.rejectCount === 0) {
			const resolve = this._promiseResolve!
			this._promiseResolve = undefined
			resolve()
		}
	}

}