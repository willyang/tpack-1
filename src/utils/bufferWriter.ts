import { Writable, WritableOptions } from "stream"

/** 表示一个缓存写入器 */
export class BufferWriter extends Writable {

	/** 最终写入的缓存对象 */
	private buffer: Buffer

	/** 获取或设置当前已写入的字节数 */
	length = 0

	/**
	 * 初始化新的缓存写入器
	 * @param options 缓存写入器的配置
	 */
	constructor(options?: BufferWriterOptions) {
		super(options)
		this.buffer = Buffer.allocUnsafe(options && options.capacity || 64 * 1024)
	}

	/** 获取或设置当前缓存可存放的字节数 */
	get capacity() { return this.buffer.length }
	set capacity(value) {
		const newBuffer = Buffer.allocUnsafe(value)
		this.buffer.copy(newBuffer, 0, 0, this.length)
		this.buffer = newBuffer
	}

	/**
	 * 确保缓存可以存放指定的字节数，如果不够则申请更大的缓存
	 * @param value 要设置的字节数
	 */
	ensureCapacity(value: number) {
		if (value < this.capacity) {
			return
		}
		this.capacity = value + Math.max(Math.round(value / 8), 4096)
	}

	/**
	 * 底层实现写入操作
	 * @param chunk 要写入的缓存
	 * @param encoding 写入的编码
	 * @param callback 写入的回调
	 * @protected
	 * @override
	 */
	_write(chunk: Buffer, encoding: string, callback: Function) {
		this.ensureCapacity(this.length + chunk.length)
		chunk.copy(this.buffer, this.length, 0)
		this.length += chunk.length
		callback()
	}

	/**
	 * 获取最后生成的缓存对象
	 * @param start 截取字节开始的位置
	 * @param end 截取字节结束的位置
	 */
	toBuffer(start = 0, end = this.length) {
		start = Math.max(start, 0)
		end = Math.min(end, this.length)
		const result = Buffer.allocUnsafe(end - start)
		this.buffer.copy(result, 0, start, end)
		return result
	}

}

/** 表示一个缓存写入器的选项 */
export interface BufferWriterOptions extends WritableOptions {
	/**
	 * 初始的缓存大小
	 * @default 65536
	 */
	capacity?: number
}