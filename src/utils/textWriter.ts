import { SourceMapBuilder } from "./sourceMap"

/** 表示一个文本写入器 */
export class TextWriter {

	/** 已写入的文本内容 */
	protected content = ""

	/** 返回当前写入的文本内容 */
	toString() { return this.content }

	/** 获取或设置使用的缩进字符 */
	indentChar = "\t"

	/** 获取当前使用的缩进字符串 */
	protected indentString = ""

	/** 增加一个缩进 */
	indent() { this.indentString += this.indentChar }

	/** 减少一个缩进 */
	unindent() { this.indentString = this.indentString.substr(0, this.indentString.length - this.indentChar.length) }

	/**
	 * 写入一段文本
	 * @param content 要写入的内容
	 * @param startIndex 要写入的内容中的开始索引（从 0 开始）
	 * @param endIndex 要写入的内容中的结束索引（从 0 开始）
	 * @param sourcePath 内容的源文件路径或索引
	 * @param sourceMap 源文件的源映射，如果存在将自动合并到当前源映射
	 * @param sourceLine 内容在源文件中的行号（从 0 开始）
	 * @param sourceColumn 内容在源文件中的列号（从 0 开始）
	 * @param name 内容对应的符号或索引
	 */
	write(content: string, startIndex?: number, endIndex?: number, sourcePath?: string | number, sourceMap?: SourceMapBuilder, sourceLine?: number, sourceColumn?: number, name?: string | number) {
		if (!this.indentString) {
			if (startIndex! > 0 || endIndex! < content.length) {
				content = content.substring(startIndex! || 0, endIndex)
			}
			this.content += content
		} else {
			startIndex = startIndex || 0
			if (endIndex == undefined) endIndex = content.length
			let prevNewLine = !this.content.length || /[\r\n]$/.test(this.content)
			for (let i = startIndex; i < endIndex; i++) {
				const ch = content.charCodeAt(i)
				const newLine = ch === 13 /*\r*/ || ch === 10 /*\n*/
				// 新行需要添加缩进
				if (prevNewLine && !newLine) {
					this.content += this.indentString
				}
				// 添加内容
				this.content += content.charAt(i)
				// 插入新行
				if (newLine && ch === 13 /*\r*/ && content.charCodeAt(i + 1) === 10 /*\n*/) {
					i++
					this.content += "\n"
				}
				prevNewLine = newLine
			}
		}
	}

}

/** 表示一个支持源映射（Source Map）的文本写入器 */
export class SourceMapTextWriter extends TextWriter {

	/** 当前使用的源映射生成器 */
	readonly sourceMapBuilder = new SourceMapBuilder()

	/** 判断或设置是否只生成行映射信息 */
	lineMappingsOnly?: boolean

	/** 获取当前生成的源映射 */
	get sourceMap() { return this.sourceMapBuilder.toJSON() }

	/** 当前写入的行号 */
	private line = 0

	/** 当前写入的列号 */
	private column = 0

	write(content: string, startIndex = 0, endIndex = content.length, sourcePath?: string | number, sourceMap?: SourceMapBuilder, sourceLine = 0, sourceColumn = 0, name?: string | number) {
		let prevNewLine = !this.content.length || /[\r\n]$/.test(this.content)
		let prevCharType: number | undefined
		let mappings = sourceMap && sourceMap.mappings[sourceLine!]
		let mappingsIndex = 0
		if (mappings) {
			while (mappingsIndex < mappings.length && mappings[mappingsIndex].generatedColumn < sourceColumn!) {
				mappingsIndex++
			}
		}
		for (let i = startIndex; i <= endIndex; i++) {
			const ch = content.charCodeAt(i)
			const newLine = ch === 13 /*\r*/ || ch === 10 /*\n*/
			const charType = sourcePath == undefined ? prevCharType :
				newLine || sourceMap || this.lineMappingsOnly ? 0 :
					ch === 32 /* */ || ch === 9 /*\t*/ ? 32 :
						ch >= 97 /*a*/ && ch <= 122 /*z*/ || ch >= 65 /*A*/ && ch <= 90 /*Z*/ || ch >= 48 /*0*/ && ch <= 57 /*9*/ || ch === 95 /*_*/ ? 65 :
							ch === 44 /*,*/ || ch === 59 /*;*/ || ch === 40 /*(*/ || ch === 41 /*)*/ || ch === 123 /*{*/ || ch === 125 /*}*/ || ch === 91 /*[*/ || ch === 93 /*]*/ ? ch : 1
			if (sourceMap) {
				// 如果提供了源映射，拷贝映射点
				if (mappings && mappingsIndex < mappings.length) {
					const mapping = mappings[mappingsIndex]
					if (mapping.generatedColumn === sourceColumn) {
						mappingsIndex++
						this.sourceMapBuilder.addMapping(this.line, this.column, mapping.sourceIndex == undefined ? undefined : sourceMap.sources[mapping.sourceIndex], mapping.sourceLine, mapping.sourceColumn, name !== undefined ? name : mapping.nameIndex == undefined ? undefined : sourceMap.names[mapping.nameIndex])
					}
				}
			} else if (charType !== prevCharType) {
				// 如果未提供源映射，在字符类型变化后自动生成映射点
				this.sourceMapBuilder.addMapping(this.line, this.column, sourcePath, sourceLine, sourceColumn, name)
			}
			if (i < endIndex) {
				// 新行需要添加缩进
				if (prevNewLine && !newLine) {
					this.content += this.indentString
					this.column += this.indentString.length
				}
				// 添加内容
				this.content += content.charAt(i)
				this.column++
				if (sourceColumn != undefined) {
					sourceColumn++
				}
				// 插入新行
				if (newLine) {
					if (ch === 13 /*\r*/ && content.charCodeAt(i + 1) === 10 /*\n*/) {
						i++
						this.content += "\n"
					}
					this.line++
					this.column = 0
					if (sourceLine != undefined) {
						sourceLine++
						sourceColumn = mappingsIndex = 0
						mappings = sourceMap && sourceMap.mappings[sourceLine!]
					}
				}

				prevNewLine = newLine
				if (charType) {
					prevCharType = charType
				}
			}

		}

	}

}