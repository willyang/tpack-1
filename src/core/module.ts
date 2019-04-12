import { SourceMapData, toSourceMapBuilder, toSourceMapObject, toSourceMapString } from "../utils/sourceMap"
import { getExt, setExt, getDir, setDir, appendFileName, prependFileName, getFileName, setFileName, resolvePath } from "../utils/path"
import { indexToLineColumn } from "../utils/lineColumn"
import { LogEntry } from "./logger"
import { Bundler } from "./builder"

/** 表示一个资源模块 */
export class Module {

	// #region 核心

	/** 获取模块的原始绝对路径 */
	readonly originalPath: string

	/** 判断当前模块是否是入口模块 */
	readonly isEntryModule: boolean

	/**
	 * 初始化新的模块
	 * @param originalPath 模块的原始绝对路径
	 * @param isEntryModule 当前模块是否是入口模块
	 */
	constructor(originalPath: string, isEntryModule: boolean) {
		this.path = this.originalPath = originalPath
		this.isEntryModule = isEntryModule
	}

	/** 负责返回当前对象的字符串形式 */
	protected inspect() { return `<${this.constructor.name} ${this.originalPath}>` }

	/** 获取或设置当前模块的状态 */
	state = ModuleState.initial

	/** 获取或设置模块的 MIME 类型 */
	type?: string

	/** 获取或设置当前模块关联的打包器 */
	bundler?: Bundler | false

	/** 判断或设置是否跳过保存当前模块 */
	noEmit?: boolean

	/** 获取或设置模块的生成时间戳 */
	emitTime?: number

	/** 重置模块的状态 */
	reset() {
		if (this.state !== ModuleState.deleted) this.state = ModuleState.initial
		this.path = this.originalPath
		this.warnings = this.errors = this.sourceMap = this.sourceMapPath = this.data = this.noEmit = this.emitTime = this.bundler = this.type = undefined
		this.reportedWarningCount = this.reportedErrorCount = 0
		if (this.props) this.props.clear()
		if (this.dependencies) this.dependencies.length = 0
		if (this.references) this.references.clear()
		if (this.siblings) this.siblings.length = 0
	}

	// #endregion

	// #region 路径

	/** 获取或设置模块的最终绝对路径 */
	path: string

	/** 获取或设置模块的最终扩展名（含点） */
	get ext() { return getExt(this.path) }
	set ext(value) { this.path = setExt(this.path, value) }

	/** 获取或设置模块的最终文件夹 */
	get dir() { return getDir(this.path) }
	set dir(value) { this.path = setDir(this.path, value) }

	/** 获取或设置模块的最终文件名 */
	get name() { return getFileName(this.path, false) }
	set name(value) { this.path = setFileName(this.path, value, false) }

	/**
	 * 在模块名前追加内容
	 * @param value 要追加的内容
	 */
	prependName(value: string) {
		this.path = prependFileName(this.path, value)
	}

	/**
	 * 在模块名（不含扩展名部分）后追加内容
	 * @param value 要追加的内容
	 */
	appendName(value: string) {
		this.path = appendFileName(this.path, value)
	}

	/** 
	 * 解析当前文件的相对路径为绝对路径
	 * @param path 要解析的相对路径
	 */
	resolve(path: string) {
		return resolvePath(this.originalPath, "..", path)
	}

	// #endregion

	// #region 数据

	/** 获取或设置模块的最终数据 */
	data?: string | Buffer

	/** 获取或设置模块的最终文本内容 */
	get content() { return this.data instanceof Buffer ? this.data.toString() : this.data! }
	set content(value) { this.data = value }

	/** 获取或设置模块的最终二进制内容 */
	get buffer() { return typeof this.data === "string" ? Buffer.from(this.data) : this.data! }
	set buffer(value) { this.data = value }

	/** 计算模块的字节大小 */
	get size() { return this.buffer!.length }

	/** 计算模块的 MD5 值 */
	get md5() { return require("../utils/crypto").md5(this.data!) }

	/** 计算模块的 SHA-1 值 */
	get sha1() { return require("../utils/crypto").sha1(this.data!) }

	// #endregion

	// #region 源映射

	/** 获取或设置当前源映射（Source Map）的最终保存绝对路径 */
	sourceMapPath?: string

	/** 获取或设置当前模块关联的源映射（Source Map）*/
	sourceMap?: SourceMapData

	/** 获取当前模块的关联源映射（Source Map）构建器 */
	get sourceMapBuilder() { return this.sourceMap ? this.sourceMap = toSourceMapBuilder(this.sourceMap) : undefined }

	/** 获取当前模块的关联源映射（Source Map）对象 */
	get sourceMapObject() { return this.sourceMap ? this.sourceMap = toSourceMapObject(this.sourceMap) : undefined }

	/** 获取当前模块的关联源映射（Source Map）字符串 */
	get sourceMapString() { return this.sourceMap ? this.sourceMap = toSourceMapString(this.sourceMap) : undefined }

	/**
	 * 合并指定的新源映射（Source Map）
	 * @param sourceMap 要合并的新源映射
	 * @description
	 * 如果是第一次生成源映射，则本方法会直接保存源映射
	 * 如果基于当前模块内容生成了新模块内容，则本方法会将原有的源映射和新生成的源映射合并保存
	 */
	applySourceMap(sourceMap: SourceMapData) {
		const exists = this.sourceMap
		if (exists) {
			(this.sourceMap = toSourceMapBuilder(sourceMap)).applySourceMap(toSourceMapBuilder(exists))
		} else {
			this.sourceMap = sourceMap
		}
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
	 */
	removeProp(key: any, value: any) {
		this.props && this.props.delete(key)
	}

	// #endregion

	// #region 错误和警告

	/** 获取当前模块相关的所有错误 */
	errors?: ModuleLogEntry[]

	/** 已报告的错误数 */
	reportedErrorCount = 0

	/** 判断当前模块是否包含错误 */
	get hasErrors() { return this.errors && this.errors.length > 0 }

	/**
	 * 添加一个错误
	 * @param log 错误的内容
	 */
	addError(log: string | Error | ModuleLogEntry) {
		const errors = this.errors || (this.errors = [])
		errors.push(this._formatLog(log))
	}

	/** 获取当前模块相关的所有警告 */
	warnings?: ModuleLogEntry[]

	/** 已报告的警告数 */
	reportedWarningCount = 0

	/** 判断当前模块是否包含警告 */
	get hasWarnings() { return this.warnings && this.warnings.length > 0 }

	/**
	 * 添加一个警告
	 * @param log 警告的内容
	 */
	addWarning(log: string | Error | ModuleLogEntry) {
		const warnings = this.warnings || (this.warnings = [])
		warnings.push(this._formatLog(log))
	}

	/**
	 * 格式化指定的日志
	 * @param log 要格式化的日志
	 */
	private _formatLog(log: string | Error | ModuleLogEntry) {
		// 转为标准格式
		if (typeof log === "string") {
			log = { message: log }
		} else if (log instanceof Error) {
			log = { message: log.message, error: log, printErrorStack: true }
		} else {
			log = { ...log }
		}
		// 推导原位置
		if (log.fileName == undefined) {
			log.fileName = this.originalPath
		}
		// 保存当前模块内容
		if (log.content == undefined && typeof this.data === "string") {
			log.content = this.data
		}
		// 计算行列号
		if (log.content != undefined && log.line == undefined && log.index != undefined) {
			const cache: number[] = []
			const loc = indexToLineColumn(log.content, log.index, cache)
			log.line = loc.line
			log.column = loc.column
			if (log.endLine == undefined && log.endIndex != undefined) {
				const loc = indexToLineColumn(log.content, log.endIndex, cache)
				log.endLine = loc.line
				log.endColumn = loc.column
			}
		}
		// 推导源位置
		if (log.computeSourceLocation !== false) {
			let location: typeof log.originalLocation = log
			let map = this.sourceMapBuilder
			for (let current: Module | undefined = this; location.line != undefined; current = current.parentModule) {
				// 根据源映射计算原始行列号
				if (map) {
					if (log.evalSourceMap === false) {
						break
					}
					const source = map.getSource(location.line, location.column || 0, false, true)
					if (!source || source.sourcePath == undefined) {
						break
					}
					const mapLocation: typeof log.originalLocation = {
						fileName: source.sourcePath,
						line: source.line!,
						column: source.column!
					}
					if (location.endLine != undefined) {
						const endSource = map.getSource(location.endLine, location.endColumn || 0, false, true)
						if (endSource && endSource.sourcePath != undefined && source.sourcePath === endSource.sourcePath) {
							mapLocation.endLine = endSource.line!
							mapLocation.endColumn = endSource.column!
						}
					}
					location = mapLocation
				}
				// 转换成父模块中的位置
				if (!current.parentModule || typeof current.parentData !== "string" || current.parentIndex == undefined || location.line == undefined) {
					break
				}
				const offsetLoc = indexToLineColumn(current.parentData, current.parentIndex)
				const parentLocation: typeof log.originalLocation = {
					fileName: current.parentModule.originalPath,
					content: current.parentData,
					line: offsetLoc.line + location.line
				}
				if (location.column != undefined) {
					parentLocation.column = location.line === 0 ? offsetLoc.column + location.column : location.column
				}
				if (location.endLine != undefined) {
					parentLocation.endLine = offsetLoc.line + location.endLine
					if (location.endColumn != undefined) {
						parentLocation.endColumn = location.endLine === 0 ? offsetLoc.column + location.endColumn : location.endColumn
					}
				}
				location = parentLocation
				map = current.parentSourceMap ? toSourceMapBuilder(current.parentSourceMap) : undefined
			}
			if (location !== log) {
				log.originalLocation = {
					fileName: log.fileName,
					content: log.content,
					line: log.line,
					column: log.column,
					endLine: log.endLine,
					endColumn: log.endColumn
				}
				Object.assign(log, location)
			}
		}
		return log
	}

	// #endregion

	// #region 依赖

	/** 获取所有直接依赖项 */
	dependencies?: Dependency[]

	/**
	 * 添加一个依赖项
	 * @param name 依赖的模块名
	 * @param options 依赖的选项
	 */
	addDependency(name: string, options?: Partial<Dependency>) {
		options = { name, ...options }
		if (this.dependencies) {
			this.dependencies.push(options as Dependency)
		} else {
			this.dependencies = [options as Dependency]
		}
		return options
	}

	// #endregion

	// #region 引用

	/** 获取当前模块的所有引用 */
	references?: Set<string>

	/**
	 * 添加一个引用，引用发生改变后当前模块需要重新加载
	 * @param target 依赖的目标模块绝对路径
	 */
	addReference(target: string) {
		const references = this.references || (this.references = new Set())
		references.add(target)
	}

	// #endregion

	// #region 兄弟模块

	/** 获取当前模块的兄弟模块 */
	siblings?: Module[]

	/**
	 * 添加一个兄弟模块，兄弟模块会随当前模块一起保存
	 * @param path 要添加的兄弟模块绝对路径
	 * @param data 要添加的兄弟模块数据
	 */
	addSibling(path: string, data: string | Buffer) {
		const module = new Module(path, false)
		module.state = ModuleState.emitting
		module.data = data
		const siblings = this.siblings || (this.siblings = [])
		siblings.push(module)
		return module
	}

	// #endregion

	// #region 子模块

	/** 如果当前模块是其它模块的一部分，则获取其所在模块 */
	parentModule?: Module

	/** 如果当前模块是其它模块的一部分，则获取其在所在模块的内容 */
	parentData?: string | Buffer

	/** 如果当前模块是其它模块的一部分，则获取其在所在模块的源映射 */
	parentSourceMap?: SourceMapData

	/** 如果当前模块是其它模块的一部分，则获取其在所在模块的位置（从 0 开始） */
	parentIndex?: number

	/**
	 * 由当前模块截取其中一部分创建新的子模块
	 * @param path 新模块的初始绝对位置
	 * @param data 新模块的数据
	 * @param index 子模块在所在模块的位置（从 0 开始）
	 */
	createSubmodule(path = this.originalPath, data = this.data, index = 0) {
		const module = new Module(path, false)
		module.data = data
		module.parentModule = this
		module.parentData = module.data
		module.parentSourceMap = module.sourceMap
		module.parentIndex = index
		return module
	}

	// #endregion

}

/** 表示资源模块的状态 */
export const enum ModuleState {
	/** 初始状态 */
	initial = 0,
	/** 模块已修改 */
	changed = 1 << 0,
	/** 模块已删除 */
	deleted = 1 << 1,
	/** 模块正在加载 */
	loading = 1 << 2,
	/** 模块已加载 */
	loaded = 1 << 3,
	/** 模块正在生成 */
	emitting = 1 << 4,
	/** 模块已生成 */
	emitted = 1 << 5,
	/** 模块已被更新 */
	updated = changed | deleted,
	/** 模块正在处理 */
	processing = loading | emitting,
}

/** 表示一个模块的日志 */
export interface ModuleLogEntry extends LogEntry {
	/** 日志相关的源位置索引（从 0 开始）*/
	index?: number
	/** 日志相关的源结束位置索引（从 0 开始）*/
	endIndex?: number
	/** 是否重新计算位置信息 */
	computeSourceLocation?: boolean
	/** 是否使用源映射（Source Map）重新计算位置信息 */
	evalSourceMap?: boolean
	/** 经过源映射计算前的原始位置 */
	originalLocation?: Pick<LogEntry, "fileName" | "content" | "line" | "column" | "endLine" | "endColumn">
}

/** 表示一个模块依赖项 */
export interface Dependency {
	/** 依赖的模块名，模块名将被继续解析成绝对路径 */
	name: string
	/** 是否是动态导入 */
	dynamic?: boolean
	/** 是否是可选导入，可选导入如果解析失败则只警告 */
	optional?: boolean
	/** 是否内联导入项 */
	inline?: boolean
	/** 从目标模块依赖的符号名称，如果为空则全导入 */
	symbols?: string[]
	/** 依赖的来源 */
	source?: string
	/** 依赖的类型 */
	type?: string
	/** 相关的源行号（从 0 开始）*/
	line?: number
	/** 相关的源列号（从 0 开始）*/
	column?: number
	/** 相关的源结束行号（从 0 开始）*/
	endLine?: number
	/** 相关的源结束列号（从 0 开始）*/
	endColumn?: number
	/** 相关的源索引（从 0 开始）*/
	index?: number
	/** 相关的源结束索引（从 0 开始）*/
	endIndex?: number
	/** 模块名解析后对应的绝对路径 */
	path?: string | false | null
	/** 路径解析后对应的模块 */
	module?: Module
}