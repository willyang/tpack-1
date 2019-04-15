import { dirname } from "path"
import { Processor, Builder } from "../core/builder"
import { Module } from "../core/module"
import { Compiler } from "../compilers/common"

export default class CleanCSS extends Compiler implements Processor {
	get vendorName() { return "clean-css" }
	compile(module: Module, options: any, CleanCSS: any, builder: Builder) {
		return new Promise<void>(resolve => {
			new CleanCSS({
				sourceMap: builder.sourceMap,
				root: dirname(module.originalPath),
				processImport: false,
				rebase: false,
				...options
			}).minify({
				[module.originalPath]: {
					styles: module.content,
					sourceMap: module.sourceMapObject
				}
			}, (error: any, result: any) => {
				if (error) {
					module.addError({
						source: CleanCSS.name,
						error: error,
						showErrorStack: true
					})
				} else {
					for (const error of result.errors) {
						module.addError({
							source: CleanCSS.name,
							message: error
						})
					}
					for (const warning of result.warnings) {
						module.addWarning({
							source: CleanCSS.name,
							message: warning
						})
					}
					module.content = result.styles
					if (result.sourceMap) {
						module.sourceMap = result.sourceMap
					}

				}
				resolve()
			})
		})
	}
}