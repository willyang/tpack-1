import { Builder, Bundler } from "../core/builder"
import { Module } from "../core/module"

/** 表示一个 CSS 模块打包器 */
export class CSSBundler implements Bundler {

	get type() { return "text/css" }

	constructor(options: CSSBundlerOptions = {}, builder: Builder) {

	}

	parse(module: Module): void | Promise<void> {

	}

	generate(module: Module): void | Promise<void> {

	}

}

/** 表示 CSS 模块打包器的选项 */
export interface CSSBundlerOptions {
	/**
	 * 是否合并 `@import`
	 * @default true
	 */
	import?: true
}