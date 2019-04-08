import { Builder, Bundler } from "../core/builder"
import { Module } from "../core/module"
import { Pattern } from "../utils/matcher"

/** 表示一个 JavaScript 模块打包器 */
export class JSBundler implements Bundler {

	get type() { return "text/javascript" }

	constructor(options: JSBundlerOptions = {}, builder: Builder) {

	}

	parse(module: Module): void | Promise<void> {

	}

	generate(module: Module): void | Promise<void> {

	}

}

/** 表示 JavaScript 模块打包器的选项 */
export interface JSBundlerOptions {
	/** 提取 JS 公共模块的规则 */
	commonModules?: boolean | CommonJSModuleRule[]
	/** 是否提取 JS 模块中的 CSS 模块 */
	extractCSSModules?: boolean
	/**
	 * 是否启用删除无用的导出
	 * @default true
	 */
	treeShaking?: boolean
	/**
	 * 是否启用作用域提升
	 * @default true
	 */
	scopeHoisting?: boolean
}

/** 表示一个 JS 公共模块拆分规则 */
export interface CommonJSModuleRule {
	/** 匹配源模块的模式，可以是通配符或正则表达式等 */
	match?: Pattern
	/** 要排除构建的源模块的的模式，可以是通配符或正则表达式等 */
	exclude?: Pattern
	/** 要求的模块最低重用次数 */
	minUseCount?: number
	/** 生成的公共模块的最小体积 */
	minSize?: number
	/** 生成的公共模块的最大体积 */
	maxSize?: number
	/** 生成的公共模块路径 */
	outPath: string | ((module: Module) => string)
}

/** 表示提取 CSS 模块的配置 */
export interface ExtractCSSModuleRule {
	/** 匹配源模块的模式，可以是通配符或正则表达式等 */
	match?: Pattern
	/** 要排除构建的源模块的的模式，可以是通配符或正则表达式等 */
	exclude?: Pattern
	/** 提取的路径 */
	outPath: string | ((module: Module, builder: Builder) => string)
}