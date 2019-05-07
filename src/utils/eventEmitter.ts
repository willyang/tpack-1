/** 表示一个事件触发器，支持异步事件 */
export class EventEmitter {

	/** 所有已添加的事件监听器 */
	private _events?: Map<string, Function | Function[]>

	/**
	 * 添加一个事件监听器
	 * @param eventName 要添加的事件名
	 * @param eventListener 要添加的事件监听器
	 * @example
	 * const ee = new EventEmitter()
	 * ee.on("error", data => console.log(data))  // 绑定 error 事件
	 * ee.emit("error", "hello")                  // 触发 error 事件，输出 hello
	 */
	on(eventName: string, eventListener: Function) {
		const events = this._events || (this._events = new Map())
		const eventListeners = events.get(eventName)
		if (eventListeners) {
			if (Array.isArray(eventListeners)) {
				eventListeners.push(eventListener)
			} else {
				events.set(eventName, [eventListeners, eventListener])
			}
		} else {
			events.set(eventName, eventListener)
		}
		return this
	}

	/**
	 * 删除一个或多个事件监听器
	 * @param eventName 要删除的事件名，如果不传递此参数，则删除所有事件监听器
	 * @param eventListener 要删除的事件监听器，如果不传递此参数，则删除指定事件的所有监听器，如果同一个监听器被添加多次，则只删除第一个
	 * @example
	 * const fn = data => console.log(data)
	 * const ee = new EventEmitter()
	 * ee.on("error", fn)         // 绑定 error 事件
	 * ee.off("error", fn)        // 解绑 error 事件
	 * ee.emit("error", "hello")  // 触发 error 事件，不输出内容
	 */
	off(eventName?: string, eventListener?: Function) {
		const events = this._events
		if (events) {
			if (eventName) {
				const eventListeners = events.get(eventName)
				if (eventListeners) {
					if (eventListener) {
						if (Array.isArray(eventListeners)) {
							const index = eventListeners.indexOf(eventListener)
							if (index >= 0) {
								eventListeners.splice(index, 1)
								eventListener = eventListeners.length as any
							}
						} else if (eventListeners === eventListener) {
							eventListener = undefined
						}
					}
					if (!eventListener) {
						events.delete(eventName)
					}
				}
			} else {
				delete this._events
			}
		}
		return this
	}

	/**
	 * 触发一个事件，执行已添加的所有事件监听器
	 * @param eventName 要触发的事件名
	 * @param eventArgs 传递给监听器的所有参数
	 * @returns 如果任一个监听器返回 `false` 则返回 `false`，否则返回 `true`
	 * @example
	 * const ee = new EventEmitter()
	 * ee.on("error", data => console.log(data))  // 绑定 error 事件
	 * ee.emit("error", "hello")                  // 触发 error 事件，输出 hello
	 */
	async emit(eventName: string, ...eventArgs: any[]) {
		const events = this._events
		if (events) {
			const eventListeners = events.get(eventName)
			if (eventListeners) {
				if (Array.isArray(eventListeners)) {
					// 避免在执行事件期间解绑事件，影响后续事件监听器执行，所以需要复制一份列表
					for (const eventListener of eventListeners.slice(0)) {
						if (await eventListener.apply(this, eventArgs) === false) {
							return false
						}
					}
				} else {
					return await eventListeners.apply(this, eventArgs) !== false
				}
			}
		}
		return true
	}

}