import { EventEmitter } from "../utils/eventEmitter"
import { Matcher, Pattern, PatternOptions } from "../utils/matcher"
import { getDir, setDir, resolvePath, pathEquals, containsPath, relativePath, normalizePath } from "../utils/path"
import { formatHRTime, insertOrdered } from "../utils/misc"
import { FileSystem } from "../utils/fileSystem"
import { LoggerOptions, Logger } from "./logger"
import { ResolverOptions, Resolver, ResolveContext } from "./resolver"
import { DevServerOptions } from "./devServer"
import { i18n } from "./i18n"
import { Module, ModuleLogEntry, ModuleState } from "./module"
import { encodeDataUri } from "../utils/base64"
import { SourceMapObject, createSourceMapURLComment } from "../utils/sourceMap"
import { isAbsoluteURL } from "../utils/url"

/** 表示一个构建器 */
export class Builder extends EventEmitter {

	// #region 选项

	/** 获取构建器的原始选项 */
	readonly options: BuilderOptions

	/** 获取构建器的基模块夹绝对路径（即工作目录）*/
	readonly baseDir: string

	/** 获取配置中所有通配符的选项 */
	readonly globOptions?: PatternOptions

	/**
	 * 初始化新的构建器
	 * @param options 构建器的选项
	 */
	constructor(options: BuilderOptions = {}) {
		super()
		this.checkOptions(options)
		this.options = options
		this.baseDir = resolvePath(options.baseDir || ".")
		const globOptions = this.globOptions = {
			baseDir: this.baseDir,
			...options.glob
		}
		this.rootDir = resolvePath(this.baseDir, options.rootDir != undefined ? options.rootDir : "src")
		this.matcher = new Matcher(options.match || (() => true), globOptions)
		this.matcher.exclude(options.exclude != undefined ? options.exclude : ["**/node_modules"], globOptions)
		this.outDir = resolvePath(this.baseDir, options.outDir != undefined ? options.outDir : "dist")

		this.noEmit = !!options.noEmit
		this.clean = this.noEmit && !!options.clean
		this.encoding = options.encoding || "utf-8"

		this.compilers = options.compilers ? initProcessors() : undefined
		this.optimizers = options.optimize && options.optimizers ? initProcessors() : undefined

		this.sourceMap = !!options.sourceMap
		this.sourceMapOptions = {
			inline: false,
			includeSourcesContent: false,
			includeFile: true,
			includeNames: true,
			indent: 0,
			//  ...(typeof options.sourceMap === "boolean" ? null : options.sourceMap)
		}

		this.noPathCheck = !!options.noPathCheck
		this.bail = !!options.bail
		this.logger = options.logger instanceof Logger ? options.logger : new Logger(options.logger)
		this.reporter = options.reporter === undefined || options.reporter === "summary" ? this.summaryReporter : !options.reporter ? undefined : options.reporter === true || options.reporter === "full" ? this.detailReporter : options.reporter

		//this.watch = !!options.watch
		// todo watch
		// todo devServer
		// this.devServer = options.devServer

		this.parallel = options.parallel || 1
		this.fs = options.fs || new FileSystem()

		if (options.plugins) {
			for (const plugin of options.plugins) {
				plugin.apply(this)
			}

		}

		this.externalModules = []
		this.output = {
			publicURL: "/",
		}

		/** 初始化所有处理器规则 */
		function initProcessors() {
			return undefined as any
			//let count = 0
			//for (let i = 0; i < rules.length; i++) {
			//	const rule = rules[i]
			//	if (!rule) {
			//		continue
			//	}
			//	const id = `${parentId}-${i}`
			//	const matcher = new Matcher(rule.match || (() => true), this.globOptions)
			//	if (rule.exclude) {
			//		matcher.exclude(rule.exclude, this.globOptions)
			//	}
			//	const host = {
			//		rule: rule,
			//		name: id,
			//		matcher: matcher,
			//		test: rule.test ? (file, context) => file.path != null && host.matcher.test(file.path) && rule.test!(file, context) : file => file.path != null && host.matcher.test(file.path),
			//		outPath: typeof rule.outPath === "string" ? pathInfo => (rule.outPath as string).replace(/<(\w+)(?:\:(\d+))?>/, (_, key, argument) => {
			//			const value = pathInfo[key as keyof PathInfo] || ""
			//			return argument ? value.slice(0, +argument) : value
			//		}) : rule.outPath,
			//		noSave: !!rule.noSave,
			//		break: !!rule.break,
			//	} as ProcessorHost
			//	if (!rule.use) {
			//		host.processor = rule
			//		count++
			//	} else if (Array.isArray(rule.use)) {
			//		host.processor = rule
			//		count += this.initProcessors(rule.use, id, host.children = [])
			//	} else {
			//		count++
			//		// 不设置 host.processor，延时加载处理器
			//	}
			//	results.push(host)
			//}
			//return count
		}

	}

	/**
	 * 检查配置的合法性
	 * @param options 要检查的配置
	 */
	protected checkOptions(options: BuilderOptions) {
		const errors: string[] = []
		if (options && typeof options === "object") {
			for (const key in options) {
				const value = options[key]
				switch (key) {
					case "baseDir":
						if (typeof value !== "string") {
							errors.push(`'${key}' should be type of string`)
						}
						break
					//case "rootDir":
					//	checkPathArray(value, key)
					//	break
					case "outDir":
						if (typeof value !== "string" && value !== false && value !== null) {
							errors.push(`'${key}' should be type of string or false`)
						}
						break
					case "match":
					case "exclude":
						checkPattern(value, key)
						break
					case "globOptions":
						if (value && typeof value !== "object") {
							errors.push(`'${key}' should be type of object`)
							break
						}
						for (const key2 in value) {
							const value2 = value[key2]
							switch (key2) {
								case "baseDir":
									if (typeof value2 !== "string") {
										errors.push(`'${key}.${key2}' should be type of string`)
									}
									break
								case "noAbsolute":
								case "noBack":
								case "noNegate":
								case "noBrace":
								case "dot":
								case "matchDir":
								case "matchBase":
								case "ignoreCase":
									if (typeof value2 !== "boolean") {
										errors.push(`'${key}.${key2}' should be type of boolean`)
									}
									break
								default:
									errors.push(`Unknonw config: '${key}.${key2}'`)
									break
							}
						}
						break
					case "clean":
					case "noSave":
					case "noPathCheck":
					case "optimize":
					case "sourceMap":
					case "watch":
					case "devServer":
						if (typeof value !== "boolean") {
							errors.push(`'${key}' should be type of boolean`)
						}
						break
					case "encoding":
						if (typeof value !== "string") {
							errors.push(`'${key}' should be type of string`)
						}
						break
					case "processors":
					case "optimizers":
						checkProcessorRules(value, key)
						break
					case "parallel":
						if (typeof value !== "number") {
							errors.push(`'${key}' should be type of number`)
						}
						break
					case "sourceMapOptions":
					case "watchOptions":
					case "devServerOptions":
						// todo
						break
					case "reporter":
						if (typeof value !== "boolean" && value !== "summary" && value !== "full" && typeof value !== "function") {
							errors.push(`'${key}' should be type of boolean, function, "summary" or "full"`)
						}
						break
					case "logger":
						// todo
						if (value && typeof value !== "object") {
							errors.push(`'${key}' should be type of object`)
						}
						break
					case "fs":
						// todo
						break
				}
			}
		} else {
			errors.push(i18n`config should type of object`)
		}
		if (errors.length) {
			const error = new TypeError(errors.join("\n"))
			error.name = "ConfigError"
			throw error
		}

		/** 检查模式的合法性 */
		function checkPattern(pattern: any, fieldName: string) {
			if (typeof pattern === "string" || pattern instanceof RegExp || typeof pattern === "function") {
				return
			} else if (Array.isArray(pattern)) {
				for (let i = 0; i < pattern.length; i++) {
					checkPattern(pattern[i], `${fieldName}[${i}]`)
				}
			} else {
				errors.push(`'${fieldName}' should be type of string, regexp, function or array`)
			}
		}

		/** 检查处理器规则的合法性 */
		function checkProcessorRules(processorRules: any, fieldName: string) {
			if (Array.isArray(processorRules)) {
				for (let i = 0; i < processorRules.length; i++) {
					const processorRule = processorRules[i] as ProcessorRule
					if (processorRule == null) {
						continue
					}
					if (typeof processorRule !== "object") {
						errors.push(`'${fieldName}[${i}]' should be type of object`)
						continue
					}
					if (processorRule.match != null) {
						checkPattern(processorRule.match, `${fieldName}[${i}].match`)
					}
					if (processorRule.exclude != null) {
						checkPattern(processorRule.exclude, `${fieldName}[${i}].exclude`)
					}
					if (processorRule.use != null) {
						if (typeof processorRule.use === "string") {
							if (!processorRule.use) {
								errors.push(`'${fieldName}[${i}].use' should not be empty string`)
							}
						} else if (Array.isArray(processorRule.use)) {
							checkProcessorRules(processorRule.use, `${fieldName}[${i}].use`)
						} else if (typeof processorRule.use !== "function") {
							errors.push(`'${fieldName}[${i}].use' should be type of string, function or array`)
						}
						if (processorRule.process != null) {
							errors.push(`'${fieldName}[${i}].use' and '${fieldName}[${i}].process' cannot be specified together`)
						}
					}
					if (processorRule.break != null && typeof processorRule.break !== "boolean") {
						errors.push(`'${fieldName}[${i}].break' should be type of boolean`)
					}
					if (processorRule.process != null && typeof processorRule.process !== "function") {
						errors.push(`'${fieldName}[${i}].process' should be type of function`)
					}
					if (processorRule.outPath != null && typeof processorRule.outPath !== "string" && typeof processorRule.outPath !== "function") {
						errors.push(`'${fieldName}[${i}].outPath' should be type of string or function`)
					}
				}
			} else {
				errors.push(`'${fieldName}' should be type of array`)
			}
		}


	}

	/**
	 * 创建一个路径匹配器
	 * @param pattern 匹配的模式
	 */
	createMatcher(pattern: Pattern) {
		return new Matcher(pattern, this.globOptions)
	}

	/** 获取构建器的版本号 */
	get version() {
		return require("../../package").version as string
	}

	/**
	 * 载入指定名字的插件
	 * @param name 要载入的插件名
	 * @param autoInstall 如果插件找不到是否自动安装
	 */
	async plugin(name: string): Promise<any> {
		return require(name)
	}

	// #endregion

	// #region 入口

	/**
	 * 根据配置执行整个构建流程
	 */
	async run() {
		return await this.build()
	}

	// #endregion

	// #region 构建项目

	/** 获取使用的模块系统 */
	readonly fs: FileSystem

	/** 获取使用的日志记录器 */
	readonly logger: Logger

	/** 所有模块打包器 */
	readonly bundlers = new Map<string, Bundler>()

	/** 获取构建的源模块夹绝对路径 */
	readonly rootDir: string

	/** 获取源模块夹中匹配需要构建的模块的匹配器 */
	readonly matcher: Matcher

	/** 获取生成模块夹绝对路径 */
	readonly outDir: string

	/** 判断是否仅构建但不保存模块 */
	readonly noEmit: boolean

	/** 判断是否在构建前清理生成模块夹 */
	readonly clean: boolean

	/** 获取本次构建的模式 */
	buildMode = BuildMode.full

	/** 构建整个项目 */
	async build() {
		const stat = new BuildStat()
		try {
			// 第一步：准备开始
			const buildTask = this.logger.begin(i18n`Start building...`)
			this.emit("buildStart", stat)
			this.logger.progress(stat.progress)

			// 第二步：清理目标模块夹
			if (this.buildMode === BuildMode.full && this.clean) {
				const cleanTask = this.logger.begin(i18n`Cleaning '${this.logger.formatPath(this.outDir)}'...`)
				await this.fs.cleanDir(this.outDir)
				this.logger.end(cleanTask)
			}

			// 第三步：搜索入口模块
			const walkTask = this.logger.begin(i18n`Searching modules...`)
			const matcher = this.matcher
			const modules = this.modules
			const entryModules = stat.entryModules
			// 全量构建，清理所有模块缓存
			modules.clear()
			await this.fs.walk(this.rootDir, {
				dir: matcher.excludeMatcher ? path => !matcher.excludeMatcher!.test(path) : undefined,
				file: path => {
					if (matcher.test(path)) {
						const module = new Module(path, true)
						modules.set(path, module)
						// 为了确保每次打包处理结果完全一致，对 entryModules 的模块按路径排序
						insertOrdered(entryModules, module, (x, y) => x.originalPath <= y.originalPath)
					}
				}
			})
			// 任务数 = 搜索任务 + 所有模块编译任务 + 打包任务 + 所有模块保存任务
			stat.doneTaskCount = 1
			stat.totalTaskCount = entryModules.length * 2 + 2
			this.logger.progress(stat.progress)
			this.logger.end(walkTask)

			// 第四步：编译、解析入口模块及其依赖
			const compileTask = this.logger.begin(i18n`Compiling modules...`)
			for (const module of entryModules) {
				this._loadModule(module).then(() => {
					stat.doneTaskCount++
					this.logger.progress(stat.progress)
				})
			}
			if (this._loadPromise) {
				await this._loadPromise
				this._loadPromise = this._loadCallback = undefined
			}
			this.logger.end(compileTask)

			// 第五步：提取公共模块
			const bundleTask = this.logger.begin(i18n`Bundling modules...`)
			for (const bundler of this.bundlers.values()) {
				bundler.bundle(entryModules, this)
			}
			stat.doneTaskCount++
			this.logger.progress(stat.progress)
			this.logger.end(bundleTask)

			// 第六步：生成、优化、保存模块
			const emitTask = this.logger.begin(i18n`Emitting modules...`)
			const promises: Promise<void>[] = []
			for (const module of entryModules) {
				promises.push(this._emitModule(module).then(() => {
					stat.doneTaskCount++
					this.logger.progress(stat.progress)
				}))
			}
			await Promise.all(promises)
			this.logger.end(emitTask)

			// 第七步：完成构建
			this.logger.end(buildTask)
		} finally {
			this.emit("buildEnd", stat)
			this.logger.reset()
		}
	}

	// #endregion

	// #region 增量构建

	/**
	 * 构建指定的文件
	 * @param path 要构建的文件绝对路径
	 */
	async buildFile(path: string) {
		try {
			// 加载模块
			this.emit("buildFileStart", path)
			const module = this.getModule(path)
			// 等待依赖加载完成
			if (this._loadPromise) {
				await this._loadPromise
				this._loadCallback = this._loadPromise = undefined
			}
			// 生成模块
			if (this.noEmit) {
				if (module.state === ModuleState.parsed) {
					await this._generateModule(module)
				}
			} else if (module.state !== ModuleState.invalid) {
				await this._emitModule(module)
			}
			return module
		} finally {
			this.emit("buildFileEnd", path)
			this.logger.reset()
		}
	}

	/**
	 * 记录某个模块已更新
	 * @param path 被更改的模块绝对路径
	 */
	commitChange(path: string) {
		// 标记更改的路径需重新解析
		const module = this.modules.get(path)
		if (module) {
			this._commitChange(module)
		}
		const references = this.references.get(path)
		if (references) {
			for (const reference of references) {
				this._commitChange(reference)
			}
		}
	}

	/**
	 * 记录某个模块已更新
	 * @param path 被更改的模块绝对路径
	 */
	private _commitChange(module: Module) {
		// 避免循环引用导致循环刷新
		if (module.state === ModuleState.invalid) {
			return
		}
		// 如果打包器支持缓存则仅重新生成该模块
		module.invalidate()
		const references = this.references.get(module.originalPath)
		if (references) {
			for (const reference of references) {
				this._commitChange(reference)
			}
		}
	}

	/**
	 * 记录某个模块已删除
	 * @param path 被删除的模块绝对路径
	 */
	commitDelete(path: string) {
		this.commitChange(path)
	}

	// #endregion

	// #region 载入模块

	/** 存储所有已加载的模块，键为模块的原始绝对路径 */
	readonly modules = new Map<string, Module>()

	/**
	 * 获取指定路径对应的模块
	 * @param path 模块原始绝对路径
	 */
	getModule(path: string) {
		let module = this.modules.get(path)
		if (module === undefined) {
			this.modules.set(path, module = new Module(path, this.isEntryModule(path)))
		}
		if (module.state === ModuleState.invalid) {
			this._loadModule(module)
		}
		return module
	}

	/**
	 * 判断指定的路径是否是入口模块
	 * @param path 要判断的原始绝对路径
	 */
	isEntryModule(path: string) {
		return containsPath(this.rootDir, path) && this.matcher.test(path)
	}

	/** 正在载入的模块数 */
	private _loadCount = 0

	/** 正在载入模块的确认对象 */
	private _loadPromise?: Promise<void>

	/** 所有模块载入完成的回调函数 */
	private _loadCallback?: () => void

	/** 所有可用的名称解析器 */
	readonly resolvers: ResolvedResolverRule[] = []

	/** 用于标记内联的查询参数名 */
	readonly inlineQuery?: string

	/** 用于标记不检查指定路径的查询参数名 */
	readonly noCheckQuery?: string

	/**
	 * 加载指定的模块及其依赖
	 * @param module 要加载的模块
	 */
	private async _loadModule(module: Module) {
		try {
			// 理论上，加载一个模块，需要等待其依赖和依赖的依赖都加载完成
			// 但如果有循环依赖，就会导致互相等待，因此加载模块时不等待依赖
			// 改用全局计数器的方式，等待所有模块都加载完毕，可以避免循环依赖问题
			if (this._loadCount++ === 0) {
				this._loadPromise = new Promise(resolve => {
					this._loadCallback = resolve
				})
			}
			// 标记已解析
			module.state = ModuleState.parsed
			// 编译模块
			await this._processModule(this.compilers, module)
			// 解析模块
			const bundler = module.bundler || (module.bundler = this.bundlers.get(module.ext.toLowerCase()))
			if (bundler) {
				if (module.data == undefined && bundler.read) {
					const readTask = this.logger.begin({
						source: i18n`Reading`,
						fileName: module.originalPath
					})
					if (bundler.read === "binary") {
						module.data = await this.fs.readFile(module.originalPath)
					} else {
						module.data = await this.fs.readFile(module.originalPath, this.encoding)
					}
					this.logger.end(readTask)
				}
				const parseTask = this.logger.begin({
					source: i18n`Parsing`,
					fileName: module.originalPath
				})
				bundler.parse(module, this)
				await this.reportErrorAndWarnings(module)
				this.logger.end(parseTask)
			}
			this.emit("parseModule", module)
			// 加载依赖
			if (module.dependencies) {
				for (const dependency of module.dependencies) {
					// 如果插件已解析模块，则跳过
					if (dependency.module) {
						if (dependency.module.state === ModuleState.invalid) {
							this._loadModule(dependency.module)
						}
						continue
					}
					// 如果插件已解析绝对路径，则不解析名称
					if (dependency.path) {
						dependency.module = this.getModule(dependency.path)
						continue
					}
					// 支持 url?nocheck&inline
					const questionIndex = dependency.name.indexOf("?")
					const query = questionIndex < 0 ? null : require("querystring").parse(dependency.name.slice(questionIndex + 1))
					if (query) {
						if (this.noCheckQuery) {
							const noCheck = query[this.noCheckQuery]
							// 移除参数
							if (noCheck !== undefined) {
								delete query[this.noCheckQuery]
								const newQuery = require("querystring").stringify(query)
								dependency.name = dependency.name.slice(0, questionIndex) + (newQuery ? "?" + newQuery : "")
							}
							if (noCheck === "" || noCheck === "true") {
								continue
							}
						}
						if (this.inlineQuery) {
							const inline = query[this.inlineQuery]
							if (inline === "" || inline === "true") {
								dependency.inline = true
							} else if (inline === "false") {
								dependency.inline = false
							}
						}
					}
					// 通配符
					const moduleName = questionIndex < 0 ? dependency.name : dependency.name.slice(0, questionIndex)
					if (moduleName.indexOf("*") >= 0) {
						for (const target of await this.fs.glob(resolvePath(module.originalPath, "..", moduleName))) {
							module.dependencies.push({
								...dependency,
								path: target
							})
						}
						continue
					}
					// 搜索可用的模块名称解析器
					for (const resolver of this.resolvers) {
						if (!resolver.matcher || resolver.matcher.test(module.path)) {
							let name = resolver.before ? resolver.before(moduleName, query, module, this) : moduleName
							let resolvedPath: string | null | false
							let detail: string | undefined
							if (resolver.resolver) {
								const containingDir = getDir(module.originalPath)
								resolvedPath = await resolver.resolver.resolve(name, containingDir)
								if (resolvedPath == null) {
									this.emit("moduleNotFound", name, dependency, file, context)
									const resolveContext: ResolveContext = { trace: [] }
									resolvedPath = await resolver.resolver.resolve(name, containingDir, resolveContext)
									detail = resolveContext.trace!.join("\n")
								}
							} else if (isAbsoluteURL(name)) {
								resolvedPath = false
							} else {
								name = resolvePath(module.originalPath, "..", name)
								if (await this.fs.existsFile(name)) {
									resolvedPath = name
								} else {
									this.emit("moduleNotFound", name, dependency, file, context)
									resolvedPath = await this.fs.existsFile(name) ? name : null
								}
							}
							if (resolver.after) resolvedPath = resolver.after(resolvedPath, name, query, module, this)
							dependency.path = resolvedPath
							if (resolvedPath) {
								dependency.module = this.getModule(resolvedPath)
							} else if (resolvedPath == null) {
								const logEntry: ModuleLogEntry = {
									source: i18n`Resolver`,
									message: resolver.resolver ? i18n`Cannot find module '${moduleName}'` : i18n`Cannot find path '${this.logger.formatPath(name)}'`,
									detail: detail,
									line: dependency.line,
									column: dependency.column,
									endLine: dependency.endLine,
									endColumn: dependency.endColumn,
									index: dependency.index,
									endIndex: dependency.endIndex,
								}
								if (dependency.optional) {
									module.addWarning(logEntry)
								} else {
									module.addError(logEntry)
								}
							}
							break
						}
					}
				}
			}
			await this.reportErrorAndWarnings(module)
		} finally {
			// 加载完成
			if (--this._loadCount === 0) {
				this._loadCallback!()
			}
		}
	}

	// #endregion

	// #region 处理模块

	/** 获取所有编译器 */
	readonly compilers: ResolvedProcessorRule[]

	/** 获取所有优化器 */
	readonly optimizers?: ResolvedProcessorRule[]

	/** 获取默认使用的模块编码 */
	readonly encoding: string

	/** 获取多核并行处理器个数 */
	readonly parallel: number

	/**
	 * 使用指定的处理器处理模块
	 * @param processors 要使用的处理器
	 * @param module 要处理的模块
	 */
	private async _processModule(processors: ResolvedProcessorRule[], module: Module) {
		for (const processor of processors) {
			// 跳过不匹配的处理器
			if (processor.matcher && !processor.matcher.test(module.path)) {
				continue
			}
			// 加载处理器
			if (!processor.processor) {
				let use = processor.use as string | ProcessorFactory
				if (typeof use === "string") {
					use = await this.plugin(use) as ProcessorFactory
				}
				if (use.name) {
					processor.name = use.name
				}
				processor.processor = new use(processor.options, this)
			}
			// 读取模块内容
			if (module.data === undefined && processor.processor.read !== false) {
				if (this.buildMode === BuildMode.pathOnly) {
					module.data = ""
				} else {
					const readTask = this.logger.begin({
						source: i18n`Reading`,
						fileName: module.originalPath
					})
					if (processor.processor.read === "binary") {
						module.data = await this.fs.readFile(module.originalPath)
					} else {
						module.data = await this.fs.readFile(module.originalPath, this.encoding)
					}
					this.logger.end(readTask)
				}
			}
			// 处理模块
			const processTask = this.logger.begin({
				source: processor.name,
				fileName: module.originalPath
			})
			await processor.processor.process(module, this)
			await this.reportErrorAndWarnings(module)
			this.logger.end(processTask)
			if (module.hasErrors) {
				break
			}
			// 计算输出路径
			if (processor.outPath) {
				module.path = resolvePath(this.rootDir, processor.outPath(module, this))
			}
			// 递归处理
			if (processor.children) {
				await this._processModule(processor.children, module)
			}
			// 根据配置终止处理
			if (processor.break) {
				break
			}
		}
	}

	// #endregion

	// #region 生成模块

	/** 判断是否需要生成源映射（Source Map）*/
	readonly sourceMap: boolean

	/** 获取生成源映射（Source Map）的选项 */
	readonly sourceMapOptions: {

		/**
		 * 获取源映射保存路径的回调函数
		 * @param module 源模块对象
		 * @param builder 当前构建器的对象
		*/
		readonly outPath?: (module: Module, builder: Builder) => string

		/** 源映射中所有源模块的根地址 */
		readonly sourceRoot?: string

		/**
		 * 获取每个源模块地址的回调函数
		 * @param sourcePath 源模块绝对路径
		 * @param sourceMapPath 源映射绝对路径
		 * @param module 源模块对象
		 * @param builder 当前构建器的对象
		 */
		readonly source?: (sourcePath: string, sourceMapPath: string, module: Module, builder: Builder) => string

		/**
		 * 获取每个源模块内容的回调函数
		 * @param sourcePath 源模块绝对路径
		 * @param sourceMapPath 源映射绝对路径
		 * @param module 源模块对象
		 * @param builder 当前构建器的对象
		 */
		readonly sourceContent?: (sourcePath: string, sourceMapPath: string, module: Module, builder: Builder) => string | Promise<string>

		/** 判断是否在源映射中内联源内容 */
		readonly includeSourcesContent?: boolean

		/** 判断是否在源映射中包含目标模块字段 */
		readonly includeFile?: boolean

		/** 判断是否在源映射中包含符号名称字段 */
		readonly includeNames?: boolean

		/** 生成源映射的缩进字符串或缩进空格数，如果为空或 0 则不缩进 */
		readonly indent: string | number

		/**
		 * 获取在生成的模块中插入的指向源映射的地址的回调函数
		 * @param sourceMapPath 源映射的最终保存绝对路径
		 * @param module 源模块对象
		 * @param builder 当前构建器的对象
		 * @returns 返回地址，如果为空则不生成源映射注释
		 */
		readonly url?: (sourceMapPath: string, module: Module, builder: Builder) => string | null

		/** 判断是否将源映射内联到生成的模块中 */
		readonly inline: boolean

	}

	/** 提取外部模块的规则 */
	readonly externalModules: ResolvedExternalModuleRule[]

	/**
	 * 生成指定的模块
	 * @param module 要生成的模块
	 */
	private async _generateModule(module: Module) {
		// 标记已生成
		module.state = ModuleState.generated
		// 生成模块
		const bundler = module.bundler
		if (bundler) {
			const generateTask = this.logger.begin({
				source: i18n`Generating`,
				fileName: module.originalPath
			})
			bundler.generate(module, this)
			await this.reportErrorAndWarnings(module)
			this.logger.end(generateTask)
		}
		// 优化模块
		if (this.optimizers && !module.hasErrors) {
			await this._processModule(this.optimizers, module)
		}
		// 转内部模块
		if (!module.isEntryModule && !module.inline) {
			module.inline = true
			for (const externalModule of this.externalModules) {
				if (externalModule.matcher && !externalModule.matcher.test(module.path)) {
					continue
				}
				if (externalModule.minSize) {
					if (module.data != undefined) {
						// 计算 module.size 性能较差，计算 module.data.length 性能较高
						// module.size >= module.data.length，如果 module.data.length > minSize，则无需计算 module.size
						if (module.data.length < externalModule.minSize && module.size < externalModule.minSize) {
							continue
						}
					} else {
						const stat = await this.fs.getStat(module.originalPath)
						if (stat.size < externalModule.minSize) {
							continue
						}
					}
				}
				module.path = externalModule.outPath(module, this)
				module.inline = false
				break
			}
		}
		// 计算最终数据
		const path = module.path = this.getOutputPath(module.path)
		// 计算源映射
		if (this.sourceMap) {
			const originalMap = module.sourceMapObject
			if (originalMap) {
				const mapPath = module.sourceMapPath || (module.sourceMapPath = this.sourceMapOptions.inline ? path : this.sourceMapOptions.outPath ? resolvePath(this.outDir, this.sourceMapOptions.outPath(module, this)) : path + ".map")
				const mapObject = module.sourceMap = {
					version: originalMap.version || 3
				} as SourceMapObject
				if (this.sourceMapOptions.includeFile) {
					mapObject.file = relativePath(getDir(mapPath), path)
				}
				if (this.sourceMapOptions.sourceRoot != undefined) {
					mapObject.sourceRoot = this.sourceMapOptions.sourceRoot
				}
				if (originalMap.sources) {
					mapObject.sources = []
					for (let i = 0; i < originalMap.sources.length; i++) {
						mapObject.sources[i] = this.sourceMapOptions.source ?
							this.sourceMapOptions.source(originalMap.sources[i], mapPath, module, this) :
							mapObject.sourceRoot ?
								mapObject.sourceRoot === "file:///" ?
									normalizePath(originalMap.sources[i]) :
									relativePath(this.rootDir, originalMap.sources[i]) :
								relativePath(getDir(mapPath), originalMap.sources[i])
					}
					if (this.sourceMapOptions.includeSourcesContent) {
						mapObject.sourcesContent = []
						for (let i = 0; i < originalMap.sources.length; i++) {
							let sourcesContent = originalMap.sourcesContent && originalMap.sourcesContent[i]
							if (sourcesContent == undefined) {
								sourcesContent = await (this.sourceMapOptions.sourceContent ? this.sourceMapOptions.sourceContent(originalMap.sources[i], mapPath, module, this) : this.fs.readFile(originalMap.sources[i], this.encoding))
							}
							mapObject.sourcesContent[i] = sourcesContent
						}
					}
				}
				if (this.sourceMapOptions.includeNames && originalMap.names && originalMap.names.length) {
					mapObject.names = originalMap.names
				}
				mapObject.mappings = originalMap.mappings || ""
				const mapURL = this.sourceMapOptions.inline ?
					encodeDataUri("application/json", JSON.stringify(mapObject, undefined, this.sourceMapOptions.indent)) :
					this.sourceMapOptions.url ? this.sourceMapOptions.url(mapPath, module, this) : relativePath(getDir(path), mapPath)
				if (mapURL != null) {
					if (module.data == undefined) {
						module.data = await this.fs.readFile(module.originalPath, this.encoding)
					}
					module.content += createSourceMapURLComment(mapURL, /\.js$/i.test(path))
				}
			}
		}
		this.emit("generateModule", module)
		if (module.references) {
			for (const reference of module.references) {
				this.addReference(module, reference)
			}
		}
	}

	/**
	 * 计算一个绝对路径的最终输出绝对路径
	 * @param path 要计算的绝对路径
	 */
	getOutputPath(path: string) {
		return setDir(path, this.outDir, this.rootDir)
	}

	// #endregion

	// #region 保存模块

	/** 判断是否跳过检查输出的路径，即是否允许生成的模块保存到 `outDir` 外、生成的模块覆盖源模块 */
	readonly noPathCheck: boolean

	/** 获取生成的所有模块，键为生成模块的绝对路径，值为对应的模块对象 */
	readonly emittedModules = new Map<string, Module>()

	/**
	 * 保存指定的模块
	 * @param module 要保存的模块
	 */
	private async _emitModule(module: Module) {
		// 保存兄弟模块
		if (module.siblings) {
			for (const sibling of module.siblings) {
				await this._emitModule(sibling)
			}
		}
		// 允许插件跳过保存当前模块
		if (module.noEmit) {
			return
		}
		// 确保模块已生成
		if (module.state === ModuleState.parsed) {
			await this._generateModule(module)
		}
		// 如果在生成模块期间模块被更新，则不再继续保存
		if (module.state !== ModuleState.generated) {
			return
		}
		// 检查路径合法
		const path = module.path
		if (!this.noPathCheck) {
			if (module.data != undefined && pathEquals(module.originalPath, path, this.fs.isCaseInsensitive)) {
				module.addError({ message: i18n`Cannot overwrite source file` })
				await this.reportErrorAndWarnings(module)
				return
			}
			if (!containsPath(this.outDir, path, this.fs.isCaseInsensitive)) {
				module.addError({ message: i18n`Cannot write files outside the outDir '${this.logger.formatPath(this.outDir)}': '${path}'` })
				await this.reportErrorAndWarnings(module)
				return
			}
		}
		// 检查路径冲突
		const exists = this.emittedModules.get(path)
		if (exists) {
			module.addError({ message: i18n`Output path conflicts with '${this.logger.formatPath(exists.originalPath)}': '${path}'` })
			await this.reportErrorAndWarnings(module)
			return
		}
		this.emittedModules.set(path, module)
		// 保存源映射
		if (!this.sourceMapOptions.inline) {
			const writeTask = this.logger.begin({
				source: i18n`Writing`,
				fileName: module.sourceMapPath
			})
			await this.fs.writeFile(module.sourceMapPath!, JSON.stringify(module.sourceMapObject, undefined, this.sourceMapOptions.indent))
			this.logger.end(writeTask)
		}
		// 保存文件
		if (module.data != undefined) {
			const writeTask = this.logger.begin({
				source: i18n`Writing`,
				fileName: module.originalPath
			})
			await this.fs.writeFile(path, module.data)
			this.logger.end(writeTask)
		} else if (!pathEquals(module.originalPath, path, this.fs.isCaseInsensitive)) {
			const copyTask = this.logger.begin({
				source: i18n`Copying`,
				fileName: module.originalPath
			})
			await this.fs.copyFile(module.originalPath, path)
			this.logger.end(copyTask)
		}
		this.emit("emitModule", module)
	}

	// #endregion

	// #region 引用

	/** 获取每个模块更新后受影响的模块列表，键为更新的模块绝对路径，值为所有受影响的模块对象 */
	readonly references = new Map<string, Set<Module>>()

	/**
	 * 标记指定模块引用了另一个模块，如果引用的模块发生更新则该模块也需要重新生成
	 * @param module 原模块
	 * @param reference 引用的模块绝对路径
	 */
	addReference(module: Module, reference: string) {
		let list = this.references.get(reference)
		if (!list) {
			list = new Set()
			this.references.set(reference, list)
		}
		list.add(module)
	}

	/**
	 * 删除指定模块的引用
	 * @param module 原模块
	 * @param reference 引用的模块绝对路径
	 */
	removeReference(module: Module, reference: string) {
		const list = this.references.get(reference)
		if (list) {
			list.delete(module)
		}
	}

	// #endregion

	// #region 错误和警告

	/** 判断是否在出现第一个错位后终止程序 */
	readonly bail: boolean

	/** 获取或设置本次构建累积错误的个数 */
	errorCount = 0

	/** 获取或设置本次构建累积警告的个数 */
	warningCount = 0

	/**
	 * 报告指定模块新产生的错误和警告
	 * @param module 要处理的模块
	 */
	protected async reportErrorAndWarnings(module: Module) {
		if (module.errors) {
			for (let i = module.reportedErrorCount; i < module.errors.length; i++) {
				const logEntry = module.errors[i]
				module.reportedErrorCount++
				this.errorCount++
				if (this.bail) {
					throw new Error(i18n`Error found in '${logEntry.fileName}': ${logEntry.message || ""}`)
				}
				if (logEntry.line != undefined && logEntry.content == undefined && logEntry.fileName != undefined && this.logger.codeFrame && logEntry.codeFrame == undefined) {
					logEntry.content = await this.fs.readFile(logEntry.fileName, this.encoding)
				}
				this.logger.error(logEntry)
			}
		}
		if (module.warnings) {
			for (let i = module.reportedWarningCount; i < module.warnings.length; i++) {
				const logEntry = module.warnings[i]
				module.reportedWarningCount++
				this.warningCount++
				if (logEntry.line != undefined && logEntry.content == undefined && logEntry.fileName != undefined && this.logger.codeFrame && logEntry.codeFrame == undefined) {
					logEntry.content = await this.fs.readFile(logEntry.fileName, this.encoding)
				}
				this.logger.warning(logEntry)
			}
		}
	}

	// #endregion

	// #region 打包

	/** 处理输出地址的配置 */
	readonly output: {

		/** 获取引用指定模块的最终地址 */
		readonly formatURL?: (module: Module, baseModule: Module) => string

		/** 获取默认引用外部文件的根地址 */
		readonly publicURL: string

	}

	/**
	 * 生成在其它模块内联的模块
	 * @param module 待生成的模块
	 */
	async generateInlineModule(module: Module) {
		if (module.state === ModuleState.parsed) {
			await this._generateModule(module)
		}
		if (module.data == undefined) {
			module.data = await this.fs.readFile(module.originalPath)
		}
		return module
	}

	/**
	 * 获取引用一个模块的最终地址
	 * @param module 引用的模块
	 * @param targetPath 目标模块
	 * @param inline 是否需内联目标模块
	 */
	buildURL(module: Module, baseModule: Module, inline?: boolean) {
		// 内联模块
		if (inline || baseModule.inline) {
			return encodeDataUri(this.getMimeType(module.ext), module.data!)
		}
		// 根地址
		if (this.output.formatURL) {
			return this.output.formatURL(module, baseModule)
		}
		return this.output.publicURL + relativePath(this.rootDir, module.path!)
	}

	/** 获取所有公共模块拆分规则 */
	readonly jsCommonModules: ResolvedJSCommonModuleRule[] = []

	/** 获取所有 MIME 类型 */
	readonly mimeTypes = new Map<string, string>()

	/** 获取指定扩展名对应的 MIME 类型 */
	getMimeType(ext: string) {
		return this.mimeTypes.get(ext) || "application/octet-stream"
	}

	// #endregion

	// #region 报告

	/** 构建完成后的报告器 */
	readonly reporter?: (stat: BuildStat) => string

	/**
	 * 概述报告器
	 */
	summaryReporter() {
		return ""
	}

	/**
	 * 详情报告器
	 */
	detailReporter() {
		return ""
	}

	// #endregion

}

/** 表示构建的选项 */
export interface BuilderOptions {

	[key: string]: any

	/**
	 * 配置中所有路径的基路径（即工作目录）
	 * @default process.cwd()
	 */
	baseDir?: string

	/**
	 * 配置中所有通配符的选项
	 */
	glob?: PatternOptions

	/**
	 * 构建的源模块夹路径
	 * @default "src"
	 */
	rootDir?: string

	/**
	 * 源模块夹中匹配需要构建的模块的模式，可以是通配符或正则表达式等
	 */
	match?: Pattern

	/**
	 * 源模块夹中要排除构建的模块或模块夹的模式，可以是通配符或正则表达式等
	 * @default ["**‌/node_modules/**‌"]
	 */
	exclude?: Pattern

	/**
	 * 生成的目标模块夹路径
	 * @default "dist"
	 */
	outDir?: string

	/**
	 * 是否仅构建但不保存模块
	 * @default false
	 */
	noEmit?: boolean

	/**
	 * 是否在构建前清理生成模块夹
	 * @default false
	 */
	clean?: boolean

	/**
	 * 默认使用的模块编码
	 * @default "utf-8"
	 */
	encoding?: string

	/** 所有模块编译器 */
	compilers?: ProcessorRule[]

	/** 模块依赖打包相关的配置 */
	bundler?: {

		/** 所有模块打包器 */
		bundlers?: { [ext: string]: Bundler }

		/** 模块名称的解析配置 */
		resolver?: ResolverRule | ResolverRule[]

		/** 提取外部模块的规则 */
		externalModules?: boolean | ExternalModuleRule[]

		/** 配置各扩展名对应的 MIME 类型 */
		mimeTypes?: { [ext: string]: string }

		/** 提取 JS 公共模块的规则 */
		commonJSModules?: boolean | CommonJSModuleRule[]

		/** 是否提取 JS 模块中的 CSS 模块 */
		extractCSSModules?: boolean | ExtractCSSModuleRule[]

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

		/** 控制模块输出相关的参数 */
		output?: {

			/**
			 * 生成最终地址的回调函数。该函数允许自定义最终保存到模块时使用的地址。
			 * @param url 包含地址信息的对象。
			 * @param module 地址所在模块。
			 * @param savePath 模块的保存位置。
			 * @return 返回生成的地址。
			*/
			formatURL?: (module: Module, baseModule: Module) => string

			/**
			 * 资源根路径
			 * @default "/"
			 */
			publicURL?: string

			/**
			 * 在最终输出目标模块时追加的前缀
			 * @example "/* This file is generated by tpack at <date>. DO NOT EDIT DIRECTLY!! *\/"
			 */
			prepend?: string | ((module: Module, owner: Module) => string)

			/**
			 * 在最终输出目标模块时追加的后缀
			 * @default ""
			 */
			append?: string | ((module: Module, owner: Module) => string)

			/**
			 * 在每个依赖模块之间插入的代码
			 * @default "\n\n"
			 */
			moduleSeperator?: string

			/**
			 * 在每个依赖模块前插入的代码
			 * @default ""
			 */
			modulePrepend?: string | ((module: Module, owner: Module) => string)

			/**
			 * 在每个依赖模块后插入的代码
			 */
			moduleAppend?: string | ((module: Module, owner: Module) => string)

			/**
			 * 用于缩进源码的字符串
			 * @default "\t"
			 */
			indentString?: string

			/**
			 * 用于换行的字符串
			 * @default "\n"
			 */
			newLine?: string

		}

	}

	/**
	 * 是否启用优化
	 * @default false
	 */
	optimize?: boolean

	/** 所有模块优化器 */
	optimizers?: ProcessorRule[]

	/**
	 * 生成源映射（Source Map）的选项
	 * @default !this.optimize
	 */
	sourceMap?: boolean | {

		/**
		 * 源映射的保存路径
		 * @default "<path>.map"
		*/
		outPath?: string | ((path: string, module: Module, builder: Builder) => string)

		/**
		 * 在生成的模块中插入的指向源映射的地址
		 * - `true`（默认）: 使用基于 `outPath` 计算的地址
		 * - `false` 不插入地址
		 * - 字符串: 使用该地址
		 * @default true
		 */
		url?: boolean | string

		/**
		 * 是否将源映射内联到生成的模块中
		 * @default false
		 */
		inline?: boolean

		/**
		 * 源映射中指向源模块的根地址
		 */
		root?: string

		/**
		 * 在源映射中内联源内容
		 * @default false
		 */
		includeSourcesContent?: boolean

		/**
		 * 在源映射中包含目标模块字段
		 * @default true
		 */
		includeFile?: boolean

		/**
		 * 在源映射中包含符号名称字段
		 * @default true
		 */
		includeNames?: boolean

	}

	/**
	 * 是否跳过检查输出的路径，即是否允许生成的模块保存到 `outDir` 外、生成的模块覆盖源模块
	 * @default false
	 */
	noPathCheck?: boolean

	/**
	 * 是否在出现第一个错位后终止程序
	 * @default false
	 */
	bail?: boolean

	/** 日志记录器的选项 */
	logger?: Logger | LoggerOptions

	/**
	 * 构建完成后的报告内容
	 * - `"summary"`（默认）: 报告构建结果的概述
	 * - `true`/`"full"`: 报告完整的构建结果
	 * - `false`/`null`: 不报告
	 * - `(context: BuildContext) => string`: 自定义报告内容
	 * @default "summary"
	 */
	reporter?: boolean | "summary" | "full" | ((stat: BuildStat) => string)

	/** 监听模块并自动重新构建的选项 */
	watch?: boolean | {

		/**
		 * 是否采用轮询监听的方式
		 * @default false
		 */
		usePolling?: boolean

		/**
		 * 轮询的间隔毫秒数
		 * @default 500
		 */
		interval?: boolean

	}

	/**
	 * 本地开发服务器的选项
	 * `true`（默认）: 使用默认端口 8000 启动开发服务器
	 * `false`/`null`: 不启动开发服务器
	 * 数字: 使用指定端口启动开发服务器
	 * 字符串: 使用指定地址启动开发服务器
	 * 对象: 根据对象的配置启动开发服务器
	 * @default 8000
	 */
	devServer?: boolean | number | string | DevServerOptions

	/**
	 * 多核并行构建的进程数
	 * @default 1
	 */
	parallel?: number

	/** 使用的模块系统 */
	fs?: FileSystem

	/** 所有插件 */
	plugins?: Plugin[]

}

/** 表示一个模块处理器 */
export interface Processor {

	/**
	 * 判断在使用当前插件处理前是否需要读取模块内容
	 * - `"text"`（默认）: 使用全局设置的编码读取模块内容
	 * - `"binary"`: 读取二进制内容
	 * - `true`: 手动读取模块内容
	 * - `false`: 不读取模块内容
	 */
	read?: boolean | "binary" | "text"

	/**
	 * 负责处理单个模块
	 * @param module 要处理的模块
	 * @param builder 所属的构建器
	 */
	process(module: Module, builder: Builder): void | Promise<void>

}

/** 表示一个处理器规则 */
export interface ProcessorRule extends Partial<Processor> {

	/** 匹配需要处理的模块或模块夹的模式 */
	match?: Pattern

	/** 要排除处理的模块或模块夹的模式 */
	exclude?: Pattern

	/** 使用的处理器路径或列表 */
	use?: string | ProcessorFactory | (ProcessorRule | undefined | null)[]

	/** 传递给处理器的附加选项 */
	options?: any

	/**
	 * 当前处理器输出的路径，其中可使用以下特殊符号
	 * - `<dir>`: 原模块夹相对路径
	 * - `<name>`: 原模块名（不含模块夹和扩展名）
	 * - `<ext>`：原扩展名（含点）
	 * - `<path>`: 原模块名相对路径，等价于 `<dir>/<name><ext>`
	 * - `<md5>`：原模块内容的 MD5 串（截取前 6 位）
	 * - `<sha1>`：原模块内容的 SHA-1 串（截取前 6 位）
	 */
	outPath?: string | ((module: Module, builder: Builder) => string)

	/** 是否跳过后续同级处理器 */
	break?: boolean

}

/** 表示一个处理器生成器 */
export interface ProcessorFactory {
	new(options: any, builder: Builder): Processor
	parallel?: boolean
}

/** 表示一个已解析的处理器规则 */
export interface ResolvedProcessorRule {

	/** 当前处理器的名字 */
	name: string

	/** 需要处理的路径的匹配器 */
	matcher?: Matcher

	/** 当前处理器的原始规则 */
	use?: string | ProcessorFactory

	/** 传递给处理器的附加选项 */
	options?: any

	/** 处理器对象 */
	processor?: Processor

	/**
	 * 获取当前处理器输出的路径
	 * @param module 要重命名的模块
	 * @param builder 所属的构建器对象
	 */
	outPath?: (module: Module, builder: Builder) => string

	/** 获取所有子级处理器 */
	children?: ResolvedProcessorRule[]

	/** 是否跳过后续同级处理器 */
	break?: boolean

}

/** 表示一个解析器规则 */
export interface ResolverRule extends ResolverOptions {

	/**
	 * 匹配源模块的模式，可以是通配符或正则表达式等
	 */
	match?: Pattern

	/**
	 * 要排除构建的源模块的的模式，可以是通配符或正则表达式等
	 */
	exclude?: Pattern

	/**
	 * 解析路径的方式
	 * - `"relative"`: 采用相对地址解析
	 * - `"node"`: 采用和 Node.js 中 `require` 相同的方式解析
	 */
	type?: "relative" | "node"

	/**
	 * 在解析模块路径之前的回调函数
	 * @param moduleName 要解析的模块名
	 * @param query 附加的查询参数
	 * @param file 当前地址所在的模块
	 * @param context 构建的上下文对象
	 * @param builder 所属的构建器对象
	 * @returns 返回实际用于解析的模块名
	 */
	before?: (moduleName: string, query: null | { [key: string]: string }, module: Module, builder: Builder) => string

	/**
	 * 在解析模块路径之后的回调函数
	 * @param resolvedPath 已解析的结果
	 * @param moduleName 要解析的模块名
	 * @param query 附加的查询参数
	 * @param file 当前地址所在的模块
	 * @param context 构建的上下文对象
	 * @param builder 所属的构建器对象
	 * @returns 返回实际解析后的路径，如果路径不存在则返回空，如果路径不存在且忽略错误则返回 `false`
	 */
	after?: (resolvedPath: string | null | false, moduleName: string, query: null | { [key: string]: string }, module: Module, builder: Builder) => string | null | false

}

/** 表示一个解析器规则 */
export interface ResolvedResolverRule {

	/** 源模块路径的匹配器 */
	readonly matcher?: Matcher

	/**
	 * 在解析模块路径之前的回调函数
	 * @param moduleName 要解析的模块名
	 * @param query 附加的查询参数
	 * @param file 当前地址所在的模块
	 * @param context 构建的上下文对象
	 * @param builder 所属的构建器对象
	 * @returns 返回实际用于解析的模块名
	 */
	readonly before?: (moduleName: string, query: null | { [key: string]: string }, module: Module, builder: Builder) => string

	/** 模块解析器对象，如果为空则只按相对路径解析 */
	readonly resolver?: Resolver

	/**
	 * 在解析模块路径之后的回调函数
	 * @param resolvedPath 已解析的结果
	 * @param moduleName 要解析的模块名
	 * @param query 附加的查询参数
	 * @param file 当前地址所在的模块
	 * @param context 构建的上下文对象
	 * @param builder 所属的构建器对象
	 * @returns 返回实际解析后的路径，如果路径不存在则返回空，如果路径不存在且忽略错误则返回 `false`
	 */
	readonly after?: (resolvedPath: string | null | false, moduleName: string, query: null | { [key: string]: string }, module: Module, builder: Builder) => string | null | false

}

/** 表示提取外部模块的配置 */
export interface ExternalModuleRule {

	/** 匹配源模块的模式，可以是通配符或正则表达式等 */
	match?: Pattern

	/** 要排除构建的源模块的的模式，可以是通配符或正则表达式等 */
	exclude?: Pattern

	/** 提取的最小字节大小  */
	minSize?: number

	/** 提取的路径 */
	outPath: string | ((module: Module, builder: Builder) => string)

}

/** 表示已解析的提取外部模块的配置 */
export interface ResolvedExternalModuleRule {

	/** 匹配的模块匹配器 */
	matcher?: Matcher

	/** 提取的最小字节大小  */
	minSize?: number

	/**
	 * 获取提取的路径的回调函数
	 * @param module 待提取的模块
	 * @param builder 所属的构建器
	 */
	outPath: (module: Module, builder: Builder) => string

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

/** 已解析的 JS 公共模块拆分规则 */
export interface ResolvedJSCommonModuleRule {

	/** 允许按当前规则拆分的模块匹配器 */
	matcher: Matcher

	/** 要求的模块最低重用次数 */
	minUseCount: number

	/** 生成的公共模块的最小体积 */
	minSize: number

	/** 生成的公共模块的最大体积 */
	maxSize: number

	/** 生成的公共模块路径 */
	outPath: (module: Module) => string

	/** 拆分后源包最多的请求数 */
	maxInitialRequests: number

	/** 拆分后源包最多的异步请求数 */
	maxAsyncRequests: number

	/** 是否拆为全局的公共模块 */
	global: boolean

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

/** 表示已解析的提取 CSS 模块的配置 */
export interface ResolvedExtractCSSModuleRule {

	/** 匹配的模块匹配器 */
	matcher?: Matcher

	/** 提取的路径 */
	outPath: (module: Module, builder: Builder) => string

}

/** 表示一个打包器 */
export interface Bundler {

	/**
	 * 判断在使用当前插件处理前是否需要读取模块内容
	 * - `"text"`（默认）: 使用全局设置的编码读取模块内容
	 * - `"binary"`: 读取二进制内容
	 * - `true`: 手动读取模块内容
	 * - `false`: 不读取模块内容
	 */
	read?: boolean | "binary" | "text"

	/**
	 * 解析指定的模块
	 * @param module 要解析的模块
	 * @param builder 当前构建器实例
	 */
	parse(module: Module, builder: Builder): void

	/**
	 * 计算模块的打包结果
	 * @param modules 所有入口模块
	 * @param builder 当前构建器实例
	 */
	bundle?(modules: Module[], builder: Builder): void

	/**
	 * 生成指定的模块
	 * @param module 要解析的模块
	 * @param builder 当前构建器实例
	 */
	generate(module: Module, builder: Builder): void

}

/** 表示一个插件 */
export interface Plugin {

	/**
	 * 应用指定的插件
	 * @param builder 当前构建器实例
	 */
	apply(builder: Builder): void

}

/** 表示一个构建结果报告 */
export class BuildStat {

	/** 获取本次构建的开始时间 */
	startTime = process.hrtime()

	/** 获取本次构建的所有入口模块 */
	entryModules: Module[] = []

	/** 获取本次构建要处理的总任务数 */
	totalTaskCount = 0

	/** 获取本次构建已处理的任务数 */
	doneTaskCount = 0

	/** 获取当前的进度（0-100） */
	get progress() { return this.totalTaskCount === 0 ? 0 : Math.floor(this.doneTaskCount * 100 / this.totalTaskCount) }

	/** 获取构建所经过的时间 */
	get elapsedTime() { return process.hrtime(this.startTime!) }

	/** 构建所经过的时间（字符串形式） */
	get elapsedTimeString() { return formatHRTime(this.elapsedTime) }

}

/** 表示构建的模式 */
export const enum BuildMode {

	/** 全量构建 */
	full,

	/** 部分构建 */
	partial,

	/** 只计算路径 */
	pathOnly

}