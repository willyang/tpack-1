import { join, isAbsolute } from "path"
import { indexToLineColumn } from "../utils/lineColumn"
import { appendName, getDir, getExt, getName, prependName, relativePath, setDir, setExt, setName } from "../utils/path"
import { SourceMapBuilder, SourceMapData, SourceMapObject, toSourceMapBuilder, toSourceMapObject } from "../utils/sourceMap"
import { LogEntry } from "./logger"
import { Bundler } from "./options"

/** 表示一个虚拟文件 */
export class VFile {

	// #region 核心

	/** 获取文件的原始路径 */
	readonly originalPath: string

	/** 判断当前文件是否是外部文件 */
	readonly isExternal: boolean

	/**
	 * 初始化新的文件
	 * @param originalPath 文件的原始路径
	 * @param isExternal 是否是外部文件
	 */
	constructor(originalPath: string, isExternal: boolean) {
		this.path = this.originalPath = originalPath
		this.isExternal = isExternal
	}

	/** 获取或设置文件的状态 */
	state = VFileState.initial

	/** 获取或设置文件关联的打包器 */
	bundler?: Bundler | false

	/** 判断或设置是否跳过保存当前文件 */
	noWrite?: boolean

	/** 获取或设置文件的 MIME 类型 */
	type?: string

	/** 文件的哈希值 */
	private _hash?: string

	/** 获取文件的哈希值，每次重新构建后哈希值都会发生变化 */
	get hash() { return this._hash || (this._hash = (VFile._id++).toString(16) + Date.now().toString(16)) }

	/** 全局唯一 ID */
	private static _id = 0

	/**
	 * 重置文件
	 * @param state 重置后的文件状态
	 */
	reset(state: VFileState) {
		this.state = state
		this.path = this.originalPath
		this.warnings = this.errors = this._sourceMapData = this.sourceMap = this.data = this._hash = this.type = this.noWrite = this.bundler = undefined
		this.reportedWarningCount = this.reportedErrorCount = this.version = 0
		if (this.props) this.props.clear()
		if (this.dependencies) this.dependencies.clear()
		if (this.references) this.references.clear()
		if (this.siblings) this.siblings.length = 0
	}

	/** 创建当前文件对象的副本 */
	clone() {
		const file = Object.assign(new VFile(this.originalPath, this.isExternal), this) as VFile
		file._hash = undefined
		if (this.props) file.props = new Map(this.props.entries())
		if (this.errors) file.errors = this.errors.slice(0)
		if (this.warnings) file.warnings = this.warnings.slice(0)
		if (this.dependencies) file.dependencies = new Set(this.dependencies)
		if (this.references) file.references = new Set(this.references)
		if (this.siblings) file.siblings = this.siblings.slice(0)
		return file
	}

	// #endregion

	// #region 路径

	/** 获取或设置文件的最终路径 */
	path: string

	/** 获取或设置文件的最终文件夹 */
	get dir() { return getDir(this.path) }
	set dir(value) { this.path = setDir(this.path, value) }

	/** 获取或设置文件的最终文件名（不含扩展名） */
	get name() { return getName(this.path, false) }
	set name(value) { this.path = setName(this.path, value, false) }

	/** 获取或设置文件的最终扩展名（含点） */
	get ext() { return getExt(this.path) }
	set ext(value) { this.path = setExt(this.path, value) }

	/**
	 * 在文件名前追加内容
	 * @param value 要追加的内容
	 */
	prependName(value: string) {
		this.path = prependName(this.path, value)
	}

	/**
	 * 在文件名（不含扩展名部分）后追加内容
	 * @param value 要追加的内容
	 */
	appendName(value: string) {
		this.path = appendName(this.path, value)
	}

	/**
	 * 获取指定路径基于当前文件原始路径对应的路径
	 * @param path 要处理的路径
	 */
	resolvePath(path: string) {
		return isAbsolute(path) ? path : join(this.originalPath, "..", path)
	}

	/**
	 * 获取指定路径基于当前文件最终路径的相对路径
	 * @param path 要处理的路径
	 */
	relativePath(path: string) {
		return relativePath(this.dir, path)
	}

	// #endregion

	// #region 数据

	/** 判断当前文件是否只需要计算路径 */
	pathOnly?: boolean

	/** 获取当前文件的修改版本 */
	version = 0

	/** 文件的最终数据 */
	private _data?: string | Buffer | object

	/** 获取或设置文件的最终数据 */
	get data() {
		return this._data
	}
	set data(value) {
		this.version++
		this._data = value
	}

	/** 获取或设置文件的最终文本内容 */
	get content() {
		return typeof this._data === "string" || this._data == undefined ? this._data as string : this._data instanceof Buffer ? this._data = this._data.toString() : this._data.toString()
	}
	set content(value) {
		this.version++
		this._data = value
	}

	/** 获取或设置文件的最终二进制内容 */
	get buffer() {
		return this._data instanceof Buffer || this._data == undefined ? this._data as Buffer : typeof this._data === "string" ? this._data = Buffer.from(this._data) : Buffer.from(this._data.toString())
	}
	set buffer(value) {
		this.version++
		this._data = value
	}

	/** 计算文件的字节大小 */
	get size() {
		return typeof this._data === "string" ? Buffer.byteLength(this._data) : this._data instanceof Buffer ? this._data.length : this._data == undefined ? 0 : Buffer.byteLength(this._data.toString())
	}

	/** 计算文件的 MD5 值 */
	get md5() {
		return this._data == undefined ? undefined! : (require("../utils/crypto") as typeof import("../utils/crypto")).md5(this._data instanceof Buffer ? this._data : this._data.toString())
	}

	/** 计算文件的 SHA-1 值 */
	get sha1() {
		return this._data == undefined ? undefined! : (require("../utils/crypto") as typeof import("../utils/crypto")).sha1(this._data instanceof Buffer ? this._data : this._data.toString())
	}

	// #endregion

	// #region 源映射

	/** 判断当前文件是否需要生成源映射（Source Map）*/
	sourceMap?: boolean

	/** 当前文件关联的原始源映射（Source Map）数据 */
	private _sourceMapData?: SourceMapData

	/** 获取或设置当前文件关联的原始源映射（Source Map）数据 */
	get sourceMapData() { return this._sourceMapData }
	set sourceMapData(value) {
		if (value) {
			this._sourceMapData = this._normalizeSourceMap(value)
		}
	}

	/** 获取或设置当前文件的关联源映射（Source Map）字符串 */
	get sourceMapString(): string | undefined { return JSON.stringify(this.sourceMapObject) }
	set sourceMapString(value) {
		if (value) {
			this._sourceMapData = this._normalizeSourceMap(value)
		}
	}

	/** 获取或设置当前文件的关联源映射（Source Map）对象 */
	get sourceMapObject() { return this._sourceMapData ? this._sourceMapData = toSourceMapObject(this._sourceMapData) : undefined }
	set sourceMapObject(value) {
		if (value) {
			this._sourceMapData = this._normalizeSourceMap(value)
		}
	}

	/** 获取或设置当前文件的关联源映射（Source Map）构建器 */
	get sourceMapBuilder() { return this._sourceMapData ? this._sourceMapData = toSourceMapBuilder(this._sourceMapData) : undefined }
	set sourceMapBuilder(value) {
		if (value) {
			this._sourceMapData = this._normalizeSourceMap(value)
		}
	}

	/**
	 * 合并指定的新源映射（Source Map）
	 * @param sourceMap 要合并的新源映射
	 * @description
	 * 如果是第一次生成源映射，则本方法会直接保存源映射
	 * 如果基于当前文件内容生成了新文件内容，则本方法会将原有的源映射和新生成的源映射合并保存
	 */
	applySourceMap(sourceMap: SourceMapData) {
		if (sourceMap) {
			sourceMap = this._normalizeSourceMap(sourceMap)
			const exists = this._sourceMapData
			if (exists) {
				(this._sourceMapData = toSourceMapBuilder(sourceMap)).applySourceMap(toSourceMapBuilder(exists))
			} else {
				this._sourceMapData = sourceMap
			}
		}
	}

	/**
	 * 规范化源映射中的路径
	 * @param sourceMap 要处理的源映射
	 */
	private _normalizeSourceMap(sourceMap: SourceMapData) {
		let newSourceMap: SourceMapObject | SourceMapBuilder
		if (sourceMap instanceof SourceMapBuilder) {
			newSourceMap = new SourceMapBuilder()
			newSourceMap.sourcesContent.push(...sourceMap.sourcesContent)
			newSourceMap.mappings.push(...sourceMap.mappings)
			newSourceMap.names.push(...sourceMap.names)
		} else {
			sourceMap = toSourceMapObject(sourceMap)
			newSourceMap = {
				version: sourceMap.version,
				sources: [],
				mappings: sourceMap.mappings,
			}
			if (sourceMap.sourcesContent) {
				newSourceMap.sourcesContent = sourceMap.sourcesContent
			}
			if (sourceMap.names) {
				newSourceMap.names = sourceMap.names
			}
		}
		newSourceMap.file = this.originalPath
		for (let i = 0; i < sourceMap.sources.length; i++) {
			newSourceMap.sources[i] = this.resolvePath(sourceMap.sources[i])
		}
		return newSourceMap
	}

	// #endregion

	// #region 自定义属性

	/** 获取所有自定义属性 */
	props?: Map<any, any>

	/**
	 * 获取指定的自定义属性
	 * @param key 属性名
	 */
	getProp(key: any) {
		return this.props && this.props.get(key)
	}

	/**
	 * 设置指定的自定义属性
	 * @param key 属性名
	 * @param value 属性值
	 */
	setProp(key: any, value: any) {
		(this.props || (this.props = new Map())).set(key, value)
	}

	/**
	 * 删除指定的自定义属性
	 * @param key 属性名
	 * @returns 如果已成功删除属性则返回 `true`，否则返回 `false`
	 */
	deleteProp(key: any) {
		return this.props ? this.props.delete(key) : false
	}

	// #endregion

	// #region 子文件

	/** 获取生成当前文件的原始文件或自身 */
	get originalFile() {
		let file: VFile = this
		while (file.sourceFile) {
			file = file.sourceFile
		}
		return file
	}

	/** 如果当前文件是从其它文件生成的，则获取源文件 */
	sourceFile?: VFile

	/** 如果当前文件是其它文件的一部分，则获取其在所在文件的内容 */
	sourceFileData?: VFile["data"]

	/** 如果当前文件是其它文件的一部分，则获取其在所在文件的源映射数据 */
	sourceFileSourceMapData?: VFile["_sourceMapData"]

	/** 如果当前文件是其它文件的一部分，则获取其在所在文件的版本 */
	sourceFileVersion?: VFile["version"]

	/** 如果当前文件是其它文件的一部分，则获取其在所在文件的索引（从 0 开始） */
	sourceFileDataIndex?: number

	/**
	 * 由当前文件截取其中一部分创建新的子文件
	 * @param path 新文件的初始路径
	 * @param data 新文件的数据
	 * @param index 子文件在所在文件的索引（从 0 开始）
	 */
	createSubfile(path?: VFile["path"], data = this.data, index = 0) {
		const file = new VFile(path != undefined ? this.resolvePath(path) : this.originalPath, true)
		file.sourceFile = this
		file.sourceFileData = this.data
		file.sourceFileSourceMapData = this._sourceMapData
		file.sourceFileVersion = this.version
		file.sourceFileDataIndex = index
		file.data = data
		return file
	}

	/** 获取当前文件的兄弟文件 */
	siblings?: VFile[]

	/**
	 * 添加一个兄弟文件，兄弟文件会随当前文件一起保存
	 * @param path 要添加的兄弟文件路径（相当于当前文件）
	 * @param data 要添加的兄弟文件数据
	 */
	addSibling(path: VFile["path"], data: VFile["data"]) {
		const sibling = new VFile(path, true)
		sibling.sourceFile = this
		Object.defineProperty(sibling, "state", { get(this: VFile) { return this.sourceFile!.state } })
		Object.defineProperty(sibling, "noWrite", { get(this: VFile) { return this.sourceFile!.noWrite } })
		if (isAbsolute(path)) {
			sibling.path = path
		} else {
			Object.defineProperty(sibling, "path", { get(this: VFile) { return join(this.sourceFile!.path, "..", path) } })
		}
		sibling.data = data
		const siblings = this.siblings || (this.siblings = [])
		siblings.push(sibling)
		return sibling
	}

	// #endregion

	// #region 依赖

	/** 获取当前文件的所有依赖 */
	dependencies?: Set<string>

	/**
	 * 添加一个依赖，依赖发生改变后当前文件需要重新加载
	 * @param target 依赖的文件路径（相当于当前文件）或文件对象或文件列表
	 * @param options 依赖的附加信息
	 */
	addDependency(target: string | VFile | (string | VFile)[], options?: any) {
		if (Array.isArray(target)) {
			for (const file of target) {
				this.addDependency(file, options)
			}
			return
		}
		if (target instanceof VFile) {
			target = target.originalFile.originalPath
		} else {
			target = this.resolvePath(target)
		}
		const dependencies = this.dependencies || (this.dependencies = new Set())
		dependencies.add(target)
	}

	/** 清除当前文件的所有依赖 */
	clearDependencies() {
		this.dependencies && this.dependencies.clear()
	}

	// #endregion

	// #region 引用

	/** 获取当前文件的所有引用 */
	references?: Set<string>

	/**
	 * 添加一个引用，当引用的文件删除后当前文件需要重新加载
	 * @param target 依赖的文件路径（相当于当前文件）或文件对象或文件列表
	 * @param options 引用的附加信息
	 */
	addReference(target: string | VFile | (string | VFile)[], options?: any) {
		if (Array.isArray(target)) {
			for (const file of target) {
				this.addReference(file, options)
			}
			return
		}
		if (target instanceof VFile) {
			target = target.originalFile.originalPath
		} else {
			target = this.resolvePath(target)
		}
		const references = this.references || (this.references = new Set())
		references.add(target)
	}

	/** 清除当前文件的所有引用 */
	clearReferences() {
		this.references && this.references.clear()
	}

	// #endregion

	// #region 错误和警告

	/** 获取当前文件相关的所有错误 */
	errors?: VFileLogEntry[]

	/** 已报告的错误数 */
	reportedErrorCount = 0

	/** 判断当前文件是否包含错误 */
	get hasErrors() { return this.errors ? this.errors.length > 0 : false }

	/**
	 * 添加一个错误
	 * @param error 错误的内容
	 */
	addError(error: string | Error | VFileLogEntry) {
		const errors = this.errors || (this.errors = [])
		errors.push(error = this._formatLog(error))
		return error
	}

	/** 获取当前文件相关的所有警告 */
	warnings?: VFileLogEntry[]

	/** 已报告的警告数 */
	reportedWarningCount = 0

	/** 判断当前文件是否包含警告 */
	get hasWarnings() { return this.warnings ? this.warnings.length > 0 : false }

	/**
	 * 添加一个警告
	 * @param warning 警告的内容
	 */
	addWarning(warning: string | Error | VFileLogEntry) {
		const warnings = this.warnings || (this.warnings = [])
		warnings.push(warning = this._formatLog(warning))
		return warning
	}

	/**
	 * 格式化指定的错误或警告
	 * @param log 要格式化的错误或警告
	 */
	private _formatLog(log: string | Error | VFileLogEntry) {
		// 转为标准格式
		if (typeof log === "string") {
			log = { message: log, raw: log }
		} else if (log instanceof Error) {
			log = { message: log.message, error: log, showStack: true, raw: log }
		} else {
			log = { ...log, raw: log }
			if (log.message === undefined && log.error) {
				log.message = log.error.message || log.error.toString()
			}
		}
		// 填充当前文件信息
		if (log.fileName === undefined) {
			log.fileName = this.originalPath
		} else if (log.fileName !== null) {
			log.fileName = this.resolvePath(log.fileName)
		}
		if (log.content == undefined && this.data != undefined && log.fileName === this.originalPath) {
			log.content = typeof this.data === "string" ? this.data : this.data.toString()
		}
		// 索引转为行列号
		if (log.content != undefined && log.line == undefined && log.index != undefined) {
			const loc = indexToLineColumn(log.content, log.index)
			log.line = loc.line
			log.column = loc.column
			if (log.endLine == undefined && log.endIndex != undefined) {
				const endLoc = indexToLineColumn(log.content, log.endIndex)
				log.endLine = endLoc.line
				log.endColumn = endLoc.column
			}
		}
		// 计算错误或警告的源位置
		if (log.computeOriginalLocation !== false) {
			for (let file: VFile | undefined = this, version = this.version, map = this._sourceMapData; log.line != undefined; version = file.sourceFileVersion, map = file.sourceFileSourceMapData, file = file.sourceFile) {
				// 使用源映射计算源位置
				if (map) {
					const sourceMapBuilder = toSourceMapBuilder(map)
					const source = sourceMapBuilder.getSource(log.line, log.column || 0, true, true)
					if (!source || source.sourcePath == undefined) {
						break
					}
					log.fileName = source.sourcePath
					log.line = source.line
					if (log.column != undefined) {
						log.column = source.column
					}
					if (log.endLine != undefined) {
						const endSource = sourceMapBuilder.getSource(log.endLine, log.endColumn || 0, true, true)
						if (endSource && endSource.sourcePath != undefined && source.sourcePath === endSource.sourcePath) {
							log.endLine = endSource.line
							if (log.endColumn != undefined) {
								log.endColumn = endSource.column
							}
						} else {
							log.endLine = log.endColumn = undefined
						}
					}
				} else if (version > 1) {
					// 文件已修改，且缺少源映射，无法定位实际位置
					break
				}
				// 如果是子文件则改成在父文件的位置
				if (!file.sourceFile || typeof file.sourceFileData !== "string" || file.sourceFileDataIndex == undefined || log.line == undefined || log.fileName !== this.originalPath) {
					break
				}
				const offsetLoc = indexToLineColumn(file.sourceFileData, file.sourceFileDataIndex)
				log.fileName = file.sourceFile.originalPath
				log.content = file.sourceFileData
				if (log.line === 0 && log.column != undefined) {
					log.column += offsetLoc.column
				}
				log.line += offsetLoc.line
				if (log.endLine != undefined) {
					if (log.endLine === 0 && log.endColumn != undefined) {
						log.endColumn += offsetLoc.column
					}
					log.endLine += offsetLoc.line
				}
			}
		}
		return log
	}

	// #endregion

}

/** 表示资源文件的状态 */
export const enum VFileState {
	/** 初始状态 */
	initial = 0,
	/** 文件已被删除 */
	deleted = 1 << 0,
	/** 文件正在创建 */
	creating = 1 << 1,
	/** 文件正在修改 */
	changing = 1 << 2,
	/** 文件正在删除 */
	deleting = 1 << 3,
	/** 文件正在加载 */
	loading = 1 << 4,
	/** 文件已加载 */
	loaded = 1 << 5,
	/** 文件正在生成 */
	emitting = 1 << 6,
	/** 文件已生成 */
	emitted = 1 << 7,
}

/** 表示一个文件的错误或警告 */
export interface VFileLogEntry extends LogEntry {
	/** 经过处理前的原始错误或警告对象 */
	raw?: string | Error | VFileLogEntry
	/** 是否使用源映射（Source Map）重新计算原始位置 */
	computeOriginalLocation?: boolean
	/** 错误或警告相关的源索引（从 0 开始）*/
	index?: number
	/** 错误或警告相关的源结束索引（从 0 开始）*/
	endIndex?: number
}