import { Builder, Bundler } from "../core/builder"
import { Module } from "../core/module"

/** 表示一个 HTML 模块打包器 */
export class HTMLBundler implements Bundler {

	get type() { return "text/html" }

	constructor(options: HTMLBundlerOptions = {}, builder: Builder) {

	}

	parse(module: Module): void | Promise<void> {

	}

	generate(module: Module): void | Promise<void> {

	}

}

/** 表示 HTML 模块打包器的选项 */
export interface HTMLBundlerOptions {
	/**
	 * 是否解析 HTML
	 *
	 * 
	 * @default true
	 */
	include?: true, // 打包 <!-- #include -->
	js?: "tsx", // JS 代码默认语言
	css?: "less" // CSS 代码默认语言
}