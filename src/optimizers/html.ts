import { Processor } from "../core/builder"
import { Module } from "../core/module"
import { Compiler } from "../compilers/common"

export default class HtmlMinifier extends Compiler implements Processor {
	get vendorName() { return "html-minifier" }
	compile(module: Module, options: any, htmlMinifier: any) {
		try {
			module.content = htmlMinifier.minify(module.content, {
				collapseWhitespace: true,
				removeComments: true,
				minifyJS: true,
				minifyCSS: true,
				...options
			})
		} catch (e) {
			module.addError({
				source: HtmlMinifier.name,
				error: e,
				message: e.message
			})
		}
	}
}