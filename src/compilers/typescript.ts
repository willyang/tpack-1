import { resolve } from "path"
import { Processor, Builder } from "../core/builder"
import { Module } from "../core/module"
import { Compiler } from "./common"

/** 表示一个 TypeScript 插件 */
export default class TS extends Compiler implements Processor {
	get outExt() { return ".js" }
	get vendorName() { return "typescript" }
	async compile(module: Module, options: any, ts: any, builder: Builder) {
		// 忽略 .d.ts 文件
		if (/\.d\.ts$/i.test(module.originalPath)) {
			module.content = ""
			return
		}
		// 设置默认值
		if (typeof options === "string") {
			options = require(resolve(options)).compilerOptions
		}
		options = {
			compilerOptions: Object.assign({
				sourceMap: builder.sourceMap,
				charset: builder.encoding,
				experimentalDecorators: true,
				newLine: "LF",
				jsx: /x$/i.test(module.originalPath) ? 2/*React*/ : 1/*Preserve*/
			}, options),
			fileName: module.originalPath,
			reportDiagnostics: true
		};
		delete options.compilerOptions.outDir

		var result = ts.transpileModule(module.content, options)
		if (result.sourceMapText) {
			// TS 未提供 API 以删除 # sourceMappingURL，手动删除之。
			result.outputText = result.outputText.replace(/\/\/# sourceMappingURL=.*\s*$/, "")
		}
		for (var i = 0; i < result.diagnostics.length; i++) {
			var diagnostic = result.diagnostics[i];
			var startLoc = diagnostic.file && diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
			var endLoc = diagnostic.file && diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start + diagnostic.length);
			module.addError({
				source: TS.name,
				message: diagnostic.messageText,
				fileName: diagnostic.file ? diagnostic.file.fileName : options.fileName,
				line: startLoc && startLoc.line,
				column: startLoc && startLoc.character,
				endLine: endLoc && endLoc.line,
				endColumn: endLoc && endLoc.character
			});
		}
		module.content = result.outputText
		if (result.sourceMapText) {
			var map = JSON.parse(result.sourceMapText)
			for (var i = 0; i < map.sources.length; i++) {
				map.sources[i] = module.resolve(map.sources[i])
			}
			module.applySourceMap(map)
		}
	}
}