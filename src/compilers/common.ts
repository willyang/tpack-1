import { Processor, Builder } from "../core/builder"
import { Module } from "../core/module"

/** 表示一个编辑器基类 */
export abstract class Compiler implements Processor {

	/** 用户提供的附加选项 */
	private _options: any

	/**
	 * 初始化新的编译器
	 * @param options 用户提供的附加选项
	 */
	constructor(options: any) {
		this._options = options
	}

	/** 获取输出的扩展名 */
	outExt?: string

	/** 当前的插件实例 */
	private _vendor: any

	/** 获取实际使用的插件 */
	abstract get vendorName(): string

	/** 
	 * 初始化插件
	 * @param vendor 已载入的插件实例
	 * @param options 用户提供的附加选项
	 * @param builder 当前的构建器对象
	 * @returns 返回处理后的附加选项
	 */
	init?(vendor: any, options: any, builder: Builder): any

	/**
	 * 当被子类重写时负责编译指定的代码
	 * @param module 要处理的模块
	 * @param options 用户的选项
	 * @param vendor 已载入的插件实例
	 * @param builder 当前的构建器对象
	 */
	abstract compile(module: Module, options: any, vendor: any, builder: Builder): Promise<void> | void

	async process(module: Module, builder: Builder) {
		// 更新扩展名
		const outExt = this.outExt
		if (outExt != undefined) {
			module.ext = outExt
		}
		// 忽略空文件
		if (!module.content) {
			return
		}
		// 安装插件
		let vendor = this._vendor
		if (vendor === undefined) {
			vendor = await builder.require(this.vendorName)
			if (this.init) {
				this._options = this.init(vendor, this._options, builder) || this._options
			}
		}
		// 编译
		return await this.compile(module, this._options, vendor, builder)
	}

}