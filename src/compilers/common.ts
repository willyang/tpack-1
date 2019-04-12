import { Processor, Builder } from "../core/builder"
import { Module } from "../core/module"

/** 表示一个编辑器 */
export abstract class Compiler implements Processor {

	/** 设置的选项 */
	private _options: any

	constructor(options: any) {
		this._options = options
	}

	async process(module: Module, builder: Builder) {
		// 更新文件名
		module.ext = this.outExt
		// 忽略空文件
		if (!module.content) {
			return
		}
		// 第一次安装插件
		let vendor = this._vendor
		if (vendor === undefined) {
			vendor = await builder.require(this.vendorName)
			if (this.init) {
				this._options = this.init(vendor, this._options, builder) || this._options
			}
		}
		// 编译
		return this.compile(module, this._options, vendor, builder)
	}

	/** 获取输出的扩展名 */
	abstract get outExt(): string

	/** 当前的插件实例 */
	private _vendor: any

	/** 获取实际使用的插件 */
	abstract get vendorName(): string

	/** 
	 * 初始化插件
	 * @param vendor 已载入的插件实例
	 * @param options 用户的选项
	 * @param builder 当前的构建器对象
	 * @returns 返回处理后的选项
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

}