import { CSSBundler, CSSBundlerOptions } from "../bundlers/css"
import { HTMLBundler, HTMLBundlerOptions } from "../bundlers/html"
import { JSBundler, JSBundlerOptions } from "../bundlers/js"
import { color, ConsoleColor } from "../utils/ansi"
import { AsyncQueue } from "../utils/asyncQueue"
import { encodeDataURI } from "../utils/base64"
import { Deferred } from "../utils/deferred"
import { EventEmitter } from "../utils/eventEmitter"
import { FileSystem } from "../utils/fileSystem"
import { Matcher, Pattern, PatternOptions } from "../utils/matcher"
import { copyToMap, formatDate, formatHRTime, insertSorted, defer } from "../utils/misc"
import { appendFileName, containsPath, deepestPath, getDir, isAbsolutePath, normalizePath, pathEquals, relativePath, resolvePath, setDir, getExt } from "../utils/path"
import { createSourceMappingURLComment, SourceMapObject } from "../utils/sourceMap"
import { DevServer, DevServerMode, DevServerOptions } from "./devServer"
import { i18n } from "./i18n"
import { Logger, LoggerOptions, LogLevel } from "./logger"
import { Dependency, Module, ModuleLogEntry, ModuleState } from "./module"
import { installPackage, resolveFrom } from "./require"
import { ResolveContext, Resolver, ResolverOptions } from "./resolver"
import { Watcher, WatcherOptions } from "./watcher"
import { OutputOptions } from "../bundlers/common"

/** 表示一个模块构建器 */
export class Builder extends EventEmitter {

	// #region 选项

	/** 获取构建器的原始选项 */
	readonly options: BuilderOptions

	/** 获取配置中所有通配符的选项 */
	readonly globOptions?: PatternOptions

	/** 获取构建器的基文件夹绝对路径（即工作目录）*/
	readonly baseDir: string

	/** 获取需要构建的源文件夹绝对路径 */
	readonly rootDir: string

	/** 获取源文件夹中匹配需要构建的模块的匹配器 */
	readonly matcher: Matcher

	/** 获取生成的目标文件夹绝对路径 */
	readonly outDir: string

	/** 获取使用的日志记录器 */
	readonly logger: Logger

	/** 获取使用的文件系统 */
	readonly fs: FileSystem

	/**
	 * 初始化新的构建器
	 * @param options 构建器的选项
	 */
	constructor(options: BuilderOptions = {}) {
		super()
		this.checkOptions(options)
		this.options = options

		const baseDir = this.baseDir = resolvePath(options.baseDir || ".")
		this.globOptions = {
			baseDir: baseDir,
			ignoreCase: false,
			...options.glob
		}
		this.encoding = options.encoding || "utf-8"
		this.noPathCheck = !!options.noPathCheck
		this.noWrite = !!options.noWrite
		this.parallel = options.parallel || 1
		this.fs = options.fs || new FileSystem()

		this.rootDir = resolvePath(baseDir, options.rootDir != undefined ? options.rootDir : "src")
		this.matcher = this.createMatcher(options.match, options.exclude != undefined ? options.exclude : ["**/node_modules/**"])
		this.outDir = resolvePath(baseDir, options.outDir != undefined ? options.outDir : "dist")
		this.filter = options.filter != undefined ? this.createMatcher(options.filter) : undefined

		this.compilerRoot = resolveProcessorRules.call(this, options.compilers || getDefaultProcessors("../../data/compilers.json"), "compilers")
		this.optimizerRoot = options.optimize ? resolveProcessorRules.call(this, options.optimizers || getDefaultProcessors("../../data/optimizers.json"), "optimizers") : undefined

		const bundlerOptions = options.bundler || {}
		this.resolvers = (Array.isArray(bundlerOptions.resolver) ? bundlerOptions.resolver : bundlerOptions.target === undefined || bundlerOptions.target === "web" ? [{
			match: "**/node_modules/**/*.js",
			extensions: [".js", ".json"]
		}, {
			match: "**/*.js",
			...bundlerOptions.resolver
		}] : [{
			match: "**/*.js",
			extensions: ["", ".js", ".json", ".node"],
			mainFields: ["main"],
			aliasFields: [],
			...bundlerOptions.resolver
		}
			]).map(resolver => ({
				matcher: resolver.match != undefined || resolver.exclude != undefined ? this.createMatcher(resolver.match || (() => true), resolver.exclude) : undefined,
				before: resolver.before,
				after: resolver.after,
				resolver: resolver.type === "relative" ? undefined : new Resolver(resolver),
				enforceCaseSensitive: resolver.enforceCaseSensitive !== false
			}))
		this.resolvers.push({ enforceCaseSensitive: true })
		this.externalModules = (bundlerOptions.externalModules || require("../../data/externalModules.json") as ExternalModuleRule[]).map(externalModule => ({
			matcher: externalModule.match != undefined || externalModule.exclude != undefined ? this.createMatcher(externalModule.match || (() => true), externalModule.exclude) : undefined,
			matchType: externalModule.matchType,
			minSize: externalModule.minSize || 0,
			outPath: typeof externalModule.outPath === "string" ? (module: Module, builder: Builder) => {
				const originalOutPath = builder.resolvePath(builder.formatPath(externalModule.outPath as string, module))
				const exists = builder.emittedModules.get(originalOutPath)
				if (!exists || exists === module) {
					return originalOutPath
				}
				for (let i = 2; ; i++) {
					const newPath = appendFileName(originalOutPath, `-${i}`)
					const exists = builder.emittedModules.get(newPath)
					if (!exists || exists === module) {
						return newPath
					}
				}
			} : externalModule.outPath
		}))

		for (const key in bundlerOptions.bundlers) {
			const bundler = bundlerOptions.bundlers[key]
			this.bundlers.set(key, typeof bundler === "function" ? new bundler(bundlerOptions, this) : bundler)
		}
		if (bundlerOptions.target === undefined || bundlerOptions.target === "web") {
			if (!this.bundlers.has(".js")) this.bundlers.set(".js", new JSBundler(bundlerOptions.js, this))
			if (!this.bundlers.has(".css")) this.bundlers.set(".css", new CSSBundler(bundlerOptions.css, this))
			if (!this.bundlers.has(".html")) this.bundlers.set(".html", new HTMLBundler(bundlerOptions.html, this))
			if (!this.bundlers.has(".htm")) this.bundlers.set(".htm", this.bundlers.get(".html")!)
		}

		this.inlineQuery = this.inlineQuery ? this.inlineQuery : this.inlineQuery === undefined ? "inline" : undefined
		this.noCheckQuery = this.noCheckQuery ? this.noCheckQuery : this.noCheckQuery === undefined ? "ignore" : undefined

		copyToMap(require("../../data/builtinModules.json"), this.builtinModules)
		if (bundlerOptions.builtinModules) {
			copyToMap(bundlerOptions.builtinModules, this.builtinModules)
		}

		copyToMap(require("../../data/mimeTypes.json"), this.mimeTypes)
		if (bundlerOptions.mimeTypes) {
			copyToMap(bundlerOptions.mimeTypes, this.mimeTypes)
		}

		this.clean = options.clean !== false && !this.noWrite && !this.filter && !containsPath(this.outDir, this.rootDir)
		this.sourceMap = !!options.sourceMap
		const sourceMapOptions = options.sourceMap === "boolean" ? undefined : options.sourceMap as Exclude<typeof options.sourceMap, boolean | undefined>
		this.sourceMapOptions = {
			outPath: sourceMapOptions && sourceMapOptions.outPath != undefined ? typeof sourceMapOptions.outPath === "string" ? (module, builder) => builder.formatPath(sourceMapOptions.outPath as string, module) : sourceMapOptions.outPath : (module, builder) => relativePath(builder.rootDir, module.path) + ".map",
			sourceRoot: sourceMapOptions ? sourceMapOptions.sourceRoot : undefined,
			source: sourceMapOptions ? sourceMapOptions.source : undefined,
			sourceContent: sourceMapOptions ? sourceMapOptions.sourceContent : undefined,
			includeSourcesContent: sourceMapOptions ? sourceMapOptions.includeSourcesContent : undefined,
			includeFile: !sourceMapOptions || sourceMapOptions.includeFile !== false,
			includeNames: !sourceMapOptions || sourceMapOptions.includeNames !== false,
			indent: sourceMapOptions && sourceMapOptions.indent || 0,
			url: sourceMapOptions && sourceMapOptions.url !== true ? sourceMapOptions.url || undefined : (sourceMapPath, module) => relativePath(module.dir, sourceMapPath),
			inline: sourceMapOptions ? !!sourceMapOptions.inline : false,
		}
		this.bail = !!options.bail
		this.logger = options.logger instanceof Logger ? options.logger : new Logger(options.logger)
		this.reporter = options.reporter === undefined || options.reporter === "summary" ? this.summaryReporter : options.reporter ? typeof options.reporter === "function" ? options.reporter : this.detailReporter : undefined

		if (options.watch || options.devServer) {
			this.watcher = new Watcher(this, typeof options.watch === "object" ? options.watch : undefined)
		}
		if (options.devServer) {
			this.devServer = new DevServer(this, options.devServer === true ? undefined : typeof options.devServer === "object" ? options.devServer : { url: options.devServer })
		}

		this.autoInstallModules = options.installCommand !== false
		this.installCommand = options.installCommand || "npm install <module> --colors"

		if (options.plugins) {
			for (const plugin of options.plugins) {
				plugin.apply(this)
			}
		}

		/** 读取默认解析器规则 */
		function getDefaultProcessors(configPath: string) {
			const processors = require(configPath) as ProcessorRule[]
			processors.forEach(rule => rule.use = resolvePath(__dirname, rule.use as string))
			return processors
		}

		/** 初始化所有处理器规则 */
		function resolveProcessorRules(this: Builder, rules: (ProcessorRule | null | undefined)[], name: string, breakTarget?: ResolvedProcessorRule) {
			let last = breakTarget
			for (let i = rules.length - 1; i >= 0; i--) {
				const rule = rules[i]
				if (!rule) {
					continue
				}
				const id = `${name}[${i}]`
				const resolved: ResolvedProcessorRule = {
					name: id,
					matcher: rule.match != undefined || rule.exclude != undefined ? this.createMatcher(rule.match || (() => true), rule.exclude) : undefined,
					processor: rule.process ? rule as Processor : undefined
				}
				if (Array.isArray(rule.use)) {
					last = resolveProcessorRules.call(this, rule.use, id, last)
				} else {
					resolved.use = rule.use
					resolved.options = rule.options
				}
				if (rule.outPath != undefined) {
					resolved.outPath = typeof rule.outPath === "string" ? (module, builder) => builder.formatPath(rule.outPath as string, module, resolved.matcher && resolved.matcher.base || undefined) : rule.outPath
				}
				resolved.nextTrue = rule.break ? breakTarget : last
				resolved.nextFalse = last
				last = resolved
			}
			return last
		}

	}

	/**
	 * 检查配置的合法性
	 * @param options 要检查的配置
	 */
	protected checkOptions(options: BuilderOptions) {
		if (options == undefined) {
			return
		}
		const errors: string[] = []
		assertObject(options, "options", {
			rootDir: assertPath,
			outDir: assertPath,
			match: assertPattern,
			exclude: assertPattern,

			compilers: assertProcessorRules,
			bundler(value, name) {
				assertObject(value, name, {
					target(value, name) {
						if (value === "web" || value === "node") {
							return
						}
						errors.push(i18n`'${name}' should be ${"web"} or ${"node"}, got ${stringify(value)}`)
					},

					resolver(value, name) {
						if (Array.isArray(value)) {
							assertArray(value, name, assertResolverRule)
							return
						}
						assertResolverRule(value, name)
					},
					externalModules(value, name) {
						assertArray(value, name, (value, name) => {
							assertObject(value, name, {
								match: assertPattern,
								exclude: assertPattern,
								matchType: assertString,
								minSize: assertNumber,
								outPath: assertStringOrFunction
							})
						})
					},

					js(value, name) {
						// todo
					},
					css(value, name) {
						// todo
					},
					html(value, name) {
						// todo
					},

					output(value, name) {
						assertObject(value, name, {
							formatURLPath: assertBoolean,
							publicURL: assertString,
							appendURLQuery: assertStringOrFunction,
							formatURL: assertFunction,
							prepend: assertStringOrFunction,
							append: assertStringOrFunction,
							modulePrepend: assertStringOrFunction,
							moduleAppend: assertStringOrFunction,
							moduleSeperator: assertString,
							indentString: assertString,
							newLine: assertString
						})
					},

					bundlers(value, name) {
						assertObject(value, name, (value, name) => {
							if (value === false || value == null || typeof value === "function") {
								return
							}
							if (typeof value === "object") {
								assertFunction((value as Bundler).parse, `${name}.parse`)
								assertFunction((value as Bundler).generate, `${name}.generate`)
								return
							}
							errors.push(i18n`'${name}' should be of type ${"function"} or ${"object"}, got ${stringify(value)}`)
						})
					},
					inlineQuery: assertFalseOrString,
					noCheckQuery: assertFalseOrString,
					builtinModules(value, name) {
						assertObject(value, name, assertFalseOrString)
					},
					mimeTypes(value, name) {
						assertObject(value, name, assertString)
					}
				})
			},
			optimize: assertBoolean,
			optimizers: assertProcessorRules,

			clean: assertBoolean,
			sourceMap(value, name) {
				assertBooleanOrObject(value, name, {
					outPath: assertStringOrFunction,
					sourceRoot: assertString,
					source: assertFunction,
					sourceContent: assertFunction,
					includeSourcesContent: assertBoolean,
					includeFile: assertBoolean,
					includeNames: assertBoolean,
					indent(name, value) {
						if (typeof value === "string" || typeof value === "number") {
							return
						}
						errors.push(i18n`'${name}' should be of type ${"string"} or ${"number"}, got ${stringify(value)}`)
					},
					url(name, value) {
						if (typeof value === "function" || typeof value === "boolean") {
							return
						}
						errors.push(i18n`'${name}' should be of type ${"boolean"} or ${"function"}, got ${stringify(value)}`)
					},
					inline: assertBoolean
				})
			},
			bail: assertBoolean,
			logger(value, name) {
				if (value instanceof Logger) {
					return
				}
				if (typeof value === "object") {
					assertObject(value, name, {
						logLevel(value, name) {
							// @ts-ignore
							assertEnum(value, name, LogLevel)
						},
						ignore(value, name) {
							if (value instanceof RegExp || typeof value === "function") {
								return
							}
							errors.push(i18n`'${name}' should be of type ${"regexp"} or ${"function"}, got ${stringify(value)}`)
						},
						colors: assertBoolean,
						showFullPath: assertBoolean,
						baseDir: assertPath,
						codeFrame(value, name) {
							assertBooleanOrObject(value, name, {
								showLine: assertBoolean,
								showColumn: assertBoolean,
								tab: assertString,
								maxWidth: assertNumber,
								maxHeight: assertNumber,
							})
						},
						persistent: assertBoolean,
						spinner: assertBoolean,
						spinnerFrames: assertStringArray,
						spinnerInterval: assertNumber,
						spinnerColor(value, name) {
							// @ts-ignore
							assertEnum(value, name, ConsoleColor)
						},
						successIcon: assertString,
						warningIcon: assertString,
						errorIcon: assertString,
						fatalIcon: assertString,
					})
					return
				}
				errors.push(i18n`'${name}' should be of type ${"Logger"} or ${"object"}, got ${stringify(value)}`)
			},
			reporter(value, name) {
				if (value === "summary" || value === "detail" || typeof value === "boolean" || typeof value === "function") {
					return
				}
				errors.push(i18n`'${name}' should be ${'"summary"'}, ${'"detail"'} or of type ${"boolean"} or ${"function"}, got ${stringify(value)}`)
			},
			watch(value, name) {
				assertBooleanOrObject(value, name, {
					usePolling: assertBoolean,
					interval: assertNumber,
					delay: assertNumber,
				})
			},
			devServer(value, name) {
				// todo
			},
			installCommand: assertFalseOrString,
			plugins(value, name) {
				assertObject(value, name, (value, name) => {
					if (value && typeof value === "object") {
						assertFunction((value as Plugin).apply, `${name}.apply`)
						return
					}
					errors.push(i18n`'${name}' should be of type ${"object"}, got ${stringify(value)}`)
				})
			},

			baseDir: assertPath,
			glob(value, name) {
				assertObject(value, name, {
					baseDir: assertPath,
					noAbsolute: assertBoolean,
					noBack: assertBoolean,
					noNegate: assertBoolean,
					noBrace: assertBoolean,
					noBracket: assertBoolean,
					dot: assertBoolean,
					matchDir: assertBoolean,
					matchBase: assertBoolean,
					ignoreCase: assertBoolean,
				})
			},
			filter: assertPattern,
			encoding: assertString,
			noPathCheck: assertBoolean,
			noWrite: assertBoolean,
			parallel: assertNumber,
			fs(value, name) {
				if (value instanceof FileSystem) {
					return
				}
				errors.push(i18n`'${name}' should be of type ${"FileSystsem"}, got ${stringify(value)}`)
			}
		})
		if (errors.length) {
			const error = new TypeError(errors.join("\n")) as Error & { code: string }
			error.code = "ConfigError"
			throw error
		}

		/** 确认变量为对象 */
		function assertObject(value: any, name: string, validateItem: { [key: string]: (value: any, name: string) => void } | ((value: any, name: string) => void)) {
			if (typeof value === "object") {
				for (const key in value) {
					const item = value[key]
					const itemKey = `${name}.${key}`
					if (typeof validateItem === "function") {
						validateItem(item, itemKey)
					} else if (item != undefined) {
						const validator = validateItem[key]
						if (validator) {
							validator(item, itemKey)
						}
					}
				}
				return
			}
			errors.push(i18n`'${name}' should be of type ${"object"}, got ${stringify(value)}`)
		}

		/** 确认变量为数组 */
		function assertArray(value: any, name: string, validateItem: (value: any, name: string) => void) {
			if (Array.isArray(value)) {
				for (let i = 0; i < value.length; i++) {
					validateItem(value[i], `${name}[${i}]`)
				}
				return
			}
			errors.push(i18n`'${name}' should be of type ${"array"}, got ${stringify(value)}`)
		}

		/** 确认变量为数字 */
		function assertNumber(value: any, name: string) {
			if (typeof value === "number") {
				return
			}
			errors.push(i18n`'${name}' should be of type ${"number"}, got ${stringify(value)}`)
		}

		/** 确认变量为布尔值 */
		function assertBoolean(value: any, name: string) {
			if (typeof value === "boolean") {
				return
			}
			errors.push(i18n`'${name}' should be of type ${"boolean"}, got ${stringify(value)}`)
		}

		/** 确认变量为字符串 */
		function assertString(value: any, name: string) {
			if (typeof value === "string") {
				return
			}
			errors.push(i18n`'${name}' should be of type ${"string"}, got ${stringify(value)}`)
		}

		/** 确认变量为函数 */
		function assertFunction(value: any, name: string) {
			if (typeof value === "function") {
				return
			}
			errors.push(i18n`'${name}' should be of type ${"function"}, got ${stringify(value)}`)
		}

		/** 确认变量为字符串或函数 */
		function assertStringOrFunction(value: any, name: string) {
			if (typeof value === "string" || typeof value === "function") {
				return
			}
			errors.push(i18n`'${name}' should be of type ${"string"} or ${"function"}, got ${stringify(value)}`)
		}

		/** 确认变量为布尔或对象 */
		function assertBooleanOrObject(value: any, name: string, validateItem: { [key: string]: (value: any, name: string) => void } | ((value: any, name: string) => void)) {
			if (typeof value === "boolean") {
				return
			}
			if (typeof value === "object") {
				assertObject(value, name, validateItem)
				return
			}
			errors.push(i18n`'${name}' should be of type ${"boolean"} or ${"object"}, got ${stringify(value)}`)
		}

		/** 确认变量为 `false` 或字符串 */
		function assertFalseOrString(value: any, name: string) {
			if (value === false || typeof value === "string") {
				return
			}
			errors.push(i18n`'${name}' should be ${"false"} or of type ${"string"}, got ${stringify(value)}`)
		}

		/** 确认变量为字符串数组 */
		function assertStringArray(value: any, name: string) {
			assertArray(value, name, assertString)
		}

		/** 确认变量为枚举值 */
		function assertEnum(value: any, name: string, fields: { [key: string]: string | number }) {
			if (value in fields) {
				return
			}
			errors.push(i18n`'${name}' should be one of: ${Object.keys(fields).filter(key => typeof fields[key] === "number").map(key => JSON.stringify(key))}, got ${stringify(value)}`)
		}

		/** 确认变量为路径 */
		function assertPath(value: any, name: string) {
			if (typeof value === "string") {
				if (/^\s|\s$|[<>|&]/.test(value)) {
					errors.push(i18n`'${name}' is not a valid path, got ${stringify(value)}`)
				}
				return
			}
			assertString(value, name)
		}

		/** 确认变量为合法的模式 */
		function assertPattern(value: any, name: string) {
			if (typeof value === "string" || value instanceof RegExp || typeof value === "function" || value instanceof Matcher) {
				return
			}
			if (Array.isArray(value)) {
				assertArray(value, name, assertPattern)
				return
			}
			errors.push(i18n`'${name}' should be of type ${"string"}, ${"regexp"}, ${"function"} or ${"array"}, got ${stringify(value)}`)
		}

		/** 确认变量为处理器规则 */
		function assertProcessorRules(value: any, name: string) {
			assertArray(value, name, (value, name) => {
				assertObject(value, name, {
					read(value, name) {
						if (typeof value === "boolean" || value === "binary" || value === "text") {
							return
						}
						errors.push(i18n`'${name}' should be ${"true"}, ${"false"}, ${'"binary"'} or ${'"text"'}, got ${stringify(value)}`)
					},
					process: assertFunction,
					match: assertPattern,
					exclude: assertPattern,
					use(value, name2) {
						if (typeof value === "string" || typeof value === "function") {
							return
						}
						if (typeof value === "object") {
							if (Array.isArray(value)) {
								assertProcessorRules(value, name2)
							}
							if (value.process != null) {
								errors.push(i18n`'${name2}' and '${name + ".process"}' cannot be specified together`)
							}
							return
						}
						errors.push(i18n`'${name2}' should be of type ${"string"}, ${"function"} or ${"array"}, got ${stringify(value)}`)
					},
					outPath: assertStringOrFunction,
					break: assertBoolean
				})
			})
		}

		/** 确认变量为解析器规则 */
		function assertResolverRule(value: any, name: string) {
			if (!value) {
				return
			}
			const relative = value.type === "relative"
			assertObject(value, name, {
				match: assertPattern,
				exclude: assertPattern,
				type(value, name) {
					if (value === "relative" || value === "node") {
						return
					}
					errors.push(i18n`'${name}' should be ${'"relative"'} or ${'"node"'}, got ${stringify(value)}`)
				},
				before: assertFunction,
				after: assertFunction,
				enforceCaseSensitive: assertBoolean,

				cache: relative ? assertNotExists : assertBoolean,
				alias: relative ? assertNotExists : (value, name) => {
					assertObject(value, name, (value, name) => {
						if (!value || typeof value === "string" || typeof value === "function") {
							return
						}
						errors.push(i18n`'${name}' should be ${"false"} or of type ${"string"} or ${"function"}, got ${stringify(value)}`)
					})
				},
				aliasFields: relative ? assertNotExists : assertStringArray,
				descriptionFiles: relative ? assertNotExists : assertStringArray,
				enforceExtension: relative ? assertNotExists : assertBoolean,
				extensions: relative ? assertNotExists : assertStringArray,
				mainFields: relative ? assertNotExists : assertStringArray,
				mainFiles: relative ? assertNotExists : assertStringArray,
				modules: relative ? assertNotExists : assertStringArray,
			})
			function assertNotExists(value: any, name: string) {
				errors.push(i18n`'${name}' cannot be specified when type is 'relative'`)
			}
		}

		/** 获取变量的字符串形式 */
		function stringify(value: any) {
			switch (typeof value) {
				case "object":
					if (value === null) {
						return "null"
					}
					if (value instanceof RegExp) {
						return value.toString()
					}
					if (value instanceof Date) {
						return `Date('${value.toLocaleString()}')`
					}
					return typeof value.constructor === "function" && value.constructor.name || "Object"
				case "function":
					return "Function"
				case "symbol":
				case "bigint":
					return value.toString()
				case "undefined":
					return "undefined"
				default:
					return JSON.stringify(value)
			}
		}
	}

	/**
	 * 创建一个路径匹配器
	 * @param pattern 匹配的模式
	 * @param exclude 排除的模式
	 */
	createMatcher(match?: Pattern, exclude?: Pattern) {
		const matcher = new Matcher(match || "**/*", this.globOptions)
		if (exclude) {
			matcher.exclude(exclude)
		}
		return matcher
	}

	/**
	 * 替换设置的输出路径中的变量
	 * @param outPath 用户设置的输出路径
	 * @param module 相关的模块
	 * @param baseDir 基路径
	 */
	formatPath(outPath: string, module: Module, baseDir = this.rootDir) {
		return outPath.replace(/<(\w+)(?::(\d+))?>/g, (source, key, argument) => {
			switch (key) {
				case "path":
					return relativePath(baseDir, module.path)
				case "dir":
					return relativePath(baseDir, module.dir)
				case "name":
					return module.name
				case "ext":
					return module.ext
				case "md5":
					return module.md5.slice(0, parseInt(argument) || 8)
				case "sha1":
					return module.sha1.slice(0, parseInt(argument) || 8)
				case "date":
					return argument ? new Date().toLocaleString() : formatDate(new Date(), argument)
				case "random":
					return Math.floor(10 ** (parseInt(argument) || 8) * Math.random())
				case "builder":
					return this.name
				case "version":
					return this.version
			}
			return source
		})
	}

	/** 获取构建器的名字 */
	get name() { return "TPack" }

	/** 获取构建器的版本号 */
	get version() { return require("../../package.json").version as string }

	/**
	 * 计算指定路径基于根目录的绝对路径
	 * @param path 要计算的相对路径
	 */
	resolvePath(path: string) {
		return resolvePath(this.rootDir, path)
	}

	/**
	 * 计算指定路径基于根目录的相对路径
	 * @param path 要计算的绝对路径
	 */
	relativePath(path: string) {
		return relativePath(this.rootDir, path)
	}

	// #endregion

	// #region 启动

	/** 当前正在使用的监听器，如果不需要监听则为 `undefined` */
	readonly watcher?: Watcher

	/** 当前正在使用的开发服务器，如果不需要服务器则为 `undefined` */
	readonly devServer?: DevServer

	/**
	 * 根据配置启动构建
	 */
	async run() {
		// 优先启动服务，如果在构建期间用户请求了某些模块，则这些模块优先构建
		if (this.devServer) {
			this.devServer.start()
		}
		if (this.watcher) {
			// 启动监听，如果在启动期间用户更新了模块，则尽早重新编译
			this.watcher.start()
			const mode = this.devServer ? this.devServer.mode : DevServerMode.normal
			// 监听模式下忽略构建错误
			try {
				await this.build(mode !== DevServerMode.normal)
			} catch (e) {
				this.logger.error(e)
			}
			// 空闲模式，继续编译所有模块
			if (mode === DevServerMode.idle) {
				this._buildModules(this.modules.values())
			}
			return 0
		}
		// 执行完整构建
		return (await this.build()).errorCount
	}

	// #endregion

	// #region 全量构建

	/** 判断是否在构建前清理生成文件夹 */
	readonly clean: boolean

	/** 判断是否仅构建但不保存文件到目标文件夹 */
	readonly noWrite: boolean

	/** 匹配本次要构建文件的匹配器 */
	readonly filter?: Matcher

	/** 确保同时只执行一个构建任务 */
	private readonly _buildQueue = new AsyncQueue()

	/**
	 * 构建整个项目
	 * @param pathOnly 是否只处理模块路径
	 * @returns 返回包含本次构建信息的对象
	 */
	build(pathOnly = false) {
		return this._buildQueue.then(async () => {
			const buildingTask = this.logger.begin(i18n`Building`)
			const result = new BuildResult()
			try {
				// 第一步：准备开始
				this.on("buildError", recordError)
				this.on("buildWarning", recordWarning)
				this.emit("buildStart", result)
				this.logger.progress(result.progress)

				// 第二步：清理目标文件夹
				if (this.clean && !pathOnly) {
					const cleaningTask = this.logger.begin(i18n`Cleaning '${this.logger.formatPath(this.outDir)}'`)
					try {
						await this.fs.cleanDir(this.outDir)
					} finally {
						this.logger.end(cleaningTask)
					}
				}

				// 第三步：搜索入口模块
				const searchingTask = this.logger.begin(i18n`Searching modules`)
				const entryModules = result.entryModules
				try {
					const filter = this.filter
					if (this.modules.size) {
						// 如果是第二次构建，不需要扫描磁盘
						for (const [path, module] of this.modules.entries()) {
							if (module.isEntryModule) {
								if (filter && !filter.test(path)) {
									continue
								}
								insertSorted(entryModules, module, (x, y) => x.originalPath <= y.originalPath)
							}
						}
					} else {
						const matcher = this.matcher
						// 选择层次最深的文件夹开始遍历，减少扫描次数
						let baseDir: string | null = this.rootDir
						matcher.patterns.forEach(pattern => {
							baseDir = deepestPath(baseDir, pattern.base, this.fs.isCaseInsensitive)
						})
						if (filter) {
							filter.patterns.forEach(pattern => {
								baseDir = deepestPath(baseDir, pattern.base, this.fs.isCaseInsensitive)
							})
						}
						if (baseDir) {
							await this.fs.walk(baseDir, {
								dir: matcher.excludeMatcher ? path => !matcher.excludeMatcher!.test(path) : undefined,
								file: path => {
									if (matcher.test(path)) {
										if (filter && !filter.test(path)) {
											return
										}
										// 初始化模块
										const module = new Module(path, true)
										module.generatesSourceMap = this.sourceMap
										this.modules.set(path, module)
										if (pathOnly) {
											module.data = ""
										}
										// 为了确保每次打包处理结果完全一致，对 entryModules 的模块按路径排序
										insertSorted(entryModules, module, (x, y) => x.originalPath <= y.originalPath)
									}
								}
							})
						}
					}
					// 任务数 = 搜索任务 + 所有模块编译任务 + 打包任务 + 所有模块保存任务
					result.doneTaskCount = 1
					result.totalTaskCount = entryModules.length * 2 + 2
					this.logger.progress(result.progress)
				} finally {
					this.logger.end(searchingTask)
				}

				// 第四步：加载（编译、解析）入口模块及其依赖
				// 理论上，加载一个模块，需要等待其依赖和依赖的依赖都加载完成
				// 但如果有循环依赖，就会导致互相等待，为简化复杂度
				// 改用全局计数器的方式，等待所有模块都加载完毕，可以避免循环依赖问题
				const loadingTask = this.logger.begin(i18n`Loading modules`)
				try {
					for (const module of entryModules) {
						if (module.state === ModuleState.initial) {
							this._loadModule(module).then(() => {
								result.doneTaskCount++
								this.logger.progress(result.progress)
							})
						} else {
							result.doneTaskCount++
							this.logger.progress(result.progress)
						}
					}
					if (this._loadDeferred.promise) {
						await this._loadDeferred.promise
					}
					// 如果在载入期间存在模块被更新了，则重新载入这些模块
					await this._loadUpdatingModules()
				} finally {
					this.logger.end(loadingTask)
				}

				// 第五步：提取公共模块
				const bundlingTask = this.logger.begin(i18n`Bundling modules`)
				try {
					for (const bundler of this.bundlers.values()) {
						if (bundler && bundler.bundle) {
							await bundler.bundle(entryModules, pathOnly, this)
						}
					}
					result.doneTaskCount++
					this.logger.progress(result.progress)
				} finally {
					this.logger.end(bundlingTask)
				}

				// 第六步：最终生成（生成、优化、保存）入口模块
				const emittingTask = this.logger.begin(i18n`Emitting modules`)
				try {
					// 在生成一个模块时需要先生成其依赖，如果并行生成模块，就会出现依赖正在生成的情况
					// 为降低复杂度，串行生成所有存在依赖的模块，并行生成不存在依赖的模块
					const writingPromises: Promise<void>[] = []
					const emittingPromises: Promise<void>[] = []
					const onEmit = this.noWrite || pathOnly ? (module: Module) => {
						if (pathOnly) {
							module.reset()
						}
						result.doneTaskCount++
						this.logger.progress(result.progress)
					} : (module: Module) => {
						writingPromises.push(this._writeModule(module).then(() => {
							result.doneTaskCount++
							this.logger.progress(result.progress)
						}))
					}
					for (const module of entryModules) {
						if (module.noEmit) {
							onEmit(module)
						} else if (module.state === ModuleState.loaded) {
							if (module.dependencies && module.dependencies.length) {
								continue
							}
							emittingPromises.push(this._emitModule(module).then(() => {
								onEmit(module)
							}))
						} else {
							result.doneTaskCount++
							this.logger.progress(result.progress)
						}
					}
					await Promise.all(emittingPromises)

					for (const module of entryModules) {
						if (module.state === ModuleState.loaded && !module.noEmit) {
							await this._emitModule(module)
							onEmit(module)
						}
					}
					await Promise.all(writingPromises)
				} finally {
					this.logger.end(emittingTask)
				}

				// 第七步：完成构建
				this.emit("buildEnd", result)
			} finally {
				this.off("buildError", recordError)
				this.off("buildWarning", recordWarning)
				this.logger.end(buildingTask)
			}
			if (this.reporter && !pathOnly) {
				this.reporter(result, this)
			}
			return result

			function recordError() { result.errorCount++ }
			function recordWarning() { result.warningCount++ }
		})
	}

	// #endregion

	// #region 增量构建

	/**
	 * 获取最终生成的模块
	 * @param outPath 模块的最终保存绝对路径
	 * @returns 返回一个模块，模块的状态表示其是否已生成成功，如果模块不存在则返回 `undefined`
	 */
	async getEmittedModule(outPath: string) {
		// 如果在用户请求一个模块时，该模块被更新，我们希望获取到该模块的最新版本
		// 技术上可以做到只等待当前模块生成，忽略其它模块
		// 假设一个页面引用了 2 个模块，第 1 个已生成，第 2 个模块正在生成
		// 如果此时 2 个模块都被修改，可能导致这个页面引了第 1 个模块的老版本和第 2 个模块的新版本
		// 为避免这个情况，只要任意模块正在构建，都延迟响应
		// 这个策略可能会降低某些情况的性能，但提高了某些情况的稳定性
		return await this._buildQueue.then(async () => {
			const module = this.emittedModules.get(outPath)
			if (module && module.state !== ModuleState.emitted) {
				await this._buildModule(module.sourceModule || module)
			}
			return module
		})
	}

	/**
	 * 构建指定的模块
	 * @param module 要构建的模块
	 */
	private async _buildModule(module: Module) {
		// 添加到列表
		this._updatingModules.add(module)
		// 确保所有模块都已加载，有些模块可能并不需要立即加载，为了简化流程全部按需要处理
		await this._loadUpdatingModules()
		// 生成模块
		if (module.state === ModuleState.loaded && !module.noEmit) {
			await this._emitModule(module)
		}
	}

	/** 所有已更新待重新构建的模块 */
	private readonly _updatingModules = new Set<Module>()

	/** 载入所有待重新构建的模块 */
	private async _loadUpdatingModules() {
		while (this._updatingModules.size) {
			for (const module of this._updatingModules) {
				// 模块已更新，重置模块
				if (module.state & (ModuleState.creating | ModuleState.changing | ModuleState.deleting)) {
					module.reset()
				}
				// 重新加载之前不是初始状态，重置后为初始状态的模块
				if (module.state === ModuleState.initial) {
					this._loadModule(module)
				}
			}
			// 目前更新的模块已全部加载中
			this._updatingModules.clear()
			// 等待依赖加载
			if (this._loadDeferred.promise) {
				await this._loadDeferred.promise
			}
		}
	}

	/**
	 * 记录一个文件已修改
	 * @param path 已修改的文件绝对路径
	 * @returns 返回受影响的文件数
	 */
	commitChange(path: string) {
		return this._commitUpdate(path, ModuleState.changing)
	}

	/**
	 * 记录一个文件已创建
	 * @param path 已创建的文件绝对路径
	 * @returns 返回受影响的文件数
	 */
	commitCreate(path: string) {
		return this._commitUpdate(path, ModuleState.creating)
	}

	/**
	 * 记录一个文件已删除
	 * @param path 已删除的文件绝对路径
	 * @returns 返回受影响的文件数
	 */
	commitDelete(path: string) {
		return this._commitUpdate(path, ModuleState.deleting)
	}

	/**
	 * 记录一个文件已更新
	 * @param path 已更新的文件绝对路径
	 * @param state 要更新的状态
	 * @returns 返回受影响的文件数
	 */
	private _commitUpdate(path: string, state: ModuleState) {
		// 为避免影响当前的生成流程，需要等待生成结束后再应用更新
		// 但如果正在加载阶段，可以直接更新然后让加载器重新加载，以避免浪费时间做生成操作
		const module = this.getModule(path)
		if (this._loadDeferred.promise) {
			const count = this._updateModule(module, state, false, module)
			// 空闲模式，将更新的模块放入构建列表
			if (!this.devServer || this.devServer.mode === DevServerMode.normal) {
				// 普通模式：全部立即重新构建，为了降低构建次数，多次更新合并一起构建
				if (state !== ModuleState.changing || count > 0) {
					this._buildQueue.then(() => {
						this._rebuild()
					})
				}
			} else if (this.devServer.mode === DevServerMode.idle) {
				// 空闲模式：全部延时重新构建
				// 强制重新创建新模块
				if (state === ModuleState.creating || count > 0) {
					this._buildQueue.then(() => {
						if (state === ModuleState.creating) {
							this._updatingModules.add(module)
						}
						this._buildModules(this._updatingModules)
					})
				}
			} else if (state === ModuleState.creating) {
				// 快速模式：新增路径
				this._addModule(module)
			}
			return count
		}
		return this._buildQueue.then(() => {
			const count = this._updateModule(module, state, true, module)
			if (!this.devServer || this.devServer.mode === DevServerMode.normal) {
				// 普通模式：全部立即重新构建，为了降低构建次数，多次更新合并一起构建
				this._rebuild()
			} else if (this.devServer.mode === DevServerMode.idle) {
				// 空闲模式：全部延时重新构建
				// 强制重新创建新模块
				if (state === ModuleState.creating) {
					this._updatingModules.add(module)
				}
				this._buildModules(this._updatingModules)
			} else if (state === ModuleState.creating) {
				// 快速模式：新增路径
				this._addModule(module)
			}
			this._updatingModules.clear()
			return count
		})
	}

	/** 在开始构建前等待的毫秒数 */
	readonly buildDelay = 10

	/** 重新构建整个项目 */
	private _rebuild() {
		this._rebuild = defer(() => { this.build() }, this.buildDelay)
		this._rebuild()
	}

	/** 添加新模块 */
	private _addModule(module: Module) {
		this._buildQueue.then(async () => {
			if (module.state === ModuleState.initial) {
				module.data = ""
				await this._buildModule(module)
				module.reset()
			}
		})
	}

	/**
	 * 更新模块及相关模块的状态
	 * @param module 要更新的模块
	 * @param state 要更新的状态
	 * @param reset 是否需要重置模块
	 * @param relatedTarget 实际发生改变的模块
	 * @returns 返回受影响的模块数
	 */
	private _updateModule(module: Module, state: ModuleState, reset: boolean, relatedTarget: Module) {
		let count = 0
		switch (module.state) {
			// 避免循环引用：不重复更新同一个模块
			case state:
				return 0
			// 如果模块在初始状态，忽略对其更新
			case ModuleState.initial:
				if (state === ModuleState.deleting) {
					module.state = ModuleState.deleted
				}
				break
			// 如果模块在删除状态，忽略对其更新
			case ModuleState.deleted:
				if (state !== ModuleState.deleting) {
					module.state = ModuleState.initial
				}
				break
			default:
				// 为避免影响正在进行的流程，此处仅更新状态
				module.state = state
				if (reset) {
					module.reset()
				}
				this._updatingModules.add(module)
				count++
				break
		}
		this.emit("updateModule", module, relatedTarget)
		// 更新受影响的模块
		const references = this.references.get(module.originalPath)
		if (references) {
			for (const reference of references) {
				count += this._updateModule(reference, ModuleState.changing, reset, relatedTarget)
			}
		}

		switch (state) {
			// 如果一个模块被删除了，则原来依赖此模块的模块可能出错
			case ModuleState.deleting:
				for (const other of this.modules.values()) {
					if (other.dependencies) {
						for (const dependency of other.dependencies) {
							if (dependency.module === module) {
								count += this._updateModule(dependency.module, ModuleState.changing, reset, relatedTarget)
							}
						}
					}
				}
				break
			// 如果创建了一个新模块，则原来存在找不到模块的错误可能被修复了，重新编译所有带错误的模块
			case ModuleState.creating:
				for (const other of this.errorModules.keys()) {
					if (other.hasWarnings || other.hasErrors) {
						count += this._updateModule(other, ModuleState.changing, reset, relatedTarget)
					}
				}
				break
		}
		return count
	}

	/** 等待构建的队列 */
	private _buildingModules?: Module[]

	/** 判断是否正在使用空闲时间构建 */
	private _building?: boolean

	/**
	 * 利用空闲时间按顺序构建模块
	 * @param modules 要构建的模块
	 */
	private _buildModules(modules: Iterable<Module>) {
		// 加入构建列表
		const buildingModules = this._buildingModules || (this._buildingModules = [])
		for (const module of modules) {
			if (module.isEntryModule) {
				buildingModules.push(module)
			}
		}
		// 按序构建
		if (!this._building) {
			this._building = true
			this._buildNextModule()
		}
	}

	/**
	 * 按顺序构建指定的模块列表
	 */
	private _buildNextModule() {
		const next = this._buildingModules!.shift()
		if (!next) {
			this._building = false
			return
		}
		if (next.state === ModuleState.emitted) {
			this._buildNextModule()
			return
		}
		this._buildQueue.then(async () => {
			await this._buildModule(next)
			setTimeout(() => {
				this._buildNextModule()
			}, this.buildDelay)
		})
	}

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
		if (this.watcher) {
			this.watcher.add(reference)
		}
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
			if (this.watcher) {
				this.watcher.remove(reference)
			}
		}
	}

	// #endregion

	// #region 加载模块

	/** 获取所有模块，键为模块的原始绝对路径 */
	readonly modules = new Map<string, Module>()

	/**
	 * 获取指定源路径对应的模块
	 * @param path 模块的原始绝对路径
	 */
	getModule(path: string) {
		let module = this.modules.get(path)
		if (module === undefined) {
			this.modules.set(path, module = new Module(path, this.isEntryModule(path)))
			module.generatesSourceMap = this.sourceMap
		}
		return module
	}

	/**
	 * 判断指定的路径是否是入口模块
	 * @param path 要判断的绝对路径
	 */
	isEntryModule(path: string) {
		return containsPath(this.rootDir, path, this.fs.isCaseInsensitive) && this.matcher.test(path)
	}

	/** 确保所有模块都加载完成后继续 */
	private _loadDeferred = new Deferred()

	/** 所有模块打包器 */
	readonly bundlers = new Map<string, Bundler | false>()

	/** 所有可用的名称解析器 */
	readonly resolvers: {
		/** 源模块路径的匹配器 */
		readonly matcher?: Matcher
		/**
		 * 在解析模块路径之前的回调函数
		 * @param dependency 要处理的依赖项
		 * @param module 当前地址所在的模块
		 * @param builder 当前的构建器对象
		 */
		readonly before?: (dependency: Dependency, module: Module, builder: Builder) => void
		/** 模块解析器对象，如果为空则只按相对路径解析 */
		readonly resolver?: Resolver
		/** 是否强制区分路径大小写 */
		readonly enforceCaseSensitive?: boolean
		/**
		 * 在解析模块路径之后的回调函数
		 * @param dependency 要处理的依赖项
		 * @param module 当前地址所在的模块
		 * @param builder 当前的构建器对象
		 */
		readonly after?: (dependency: Dependency, module: Module, builder: Builder) => void
	}[] = []

	/** 用于标记不检查指定路径的查询参数名 */
	readonly noCheckQuery?: string

	/** 用于标记内联的查询参数名 */
	readonly inlineQuery?: string

	/** 获取所有内置模块 */
	readonly builtinModules = new Map<string, string | false>()

	/**
	 * 加载指定的模块及其依赖
	 * @param module 要加载的模块
	 * @description 本函数仅等待当前模块加载完成，不会等待依赖
	 */
	private async _loadModule(module: Module) {
		try {
			// 准备加载
			this._loadDeferred.reject()
			module.state = ModuleState.loading
			// 编译模块
			await this._processModule(this.compilerRoot, module)
			if (module.state !== ModuleState.loading) {
				return
			}
			// 解析模块
			let bundler = module.bundler
			if (bundler === undefined) module.bundler = bundler = this.bundlers.get(module.ext.toLowerCase())
			if (bundler) {
				if (module.data === undefined && bundler.read !== false) {
					if (!await this._readModule(module, bundler.read === "text", i18n`Bundler`)) {
						return
					}
					if (module.state !== ModuleState.loading) {
						return
					}
				}
				const parsingTask = this.logger.begin(`${color(i18n`Parsing`, ConsoleColor.brightCyan)} ${this.logger.formatPath(module.originalPath)}`)
				try {
					await bundler.parse(module, this)
				} catch (e) {
					module.addError({
						source: i18n`Bundler`,
						error: e,
						showErrorStack: true
					})
				} finally {
					this.logger.end(parsingTask)
				}
				if (module.state !== ModuleState.loading) {
					return
				}
			}
			// 加载依赖
			if (module.dependencies) {
				for (const dependency of module.dependencies) {
					// 如果插件已解析模块，则跳过
					if (dependency.module) {
						if (dependency.module.state === ModuleState.initial) {
							this._loadModule(dependency.module)
						}
						continue
					}
					// 如果插件已解析绝对路径，则不解析名称
					if (dependency.path) {
						dependency.module = this.getModule(dependency.path)
						if (dependency.module.state === ModuleState.initial) {
							this._loadModule(dependency.module)
						}
						continue
					}
					// 支持 ?nocheck&inline
					if (dependency.query) {
						const query = require("querystring").parse(dependency.query)
						if (this.noCheckQuery) {
							const noCheck = query[this.noCheckQuery]
							if (noCheck !== undefined) {
								delete query[this.noCheckQuery]
								dependency.query = require("querystring").stringify(query)
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
					if (!dependency.name) {
						continue
					}
					// 导入通配符
					if (dependency.name.indexOf("*") >= 0) {
						for (const target of await this.fs.glob(dependency.name = resolvePath(module.originalPath, "..", dependency.name))) {
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
							if (resolver.before) {
								resolver.before(dependency, module, this)
							}
							const name = dependency.name
							let resolvedPath: string | null | false
							let detail: string | undefined
							if (resolver.resolver) {
								// 解析内置模块
								let builtinModule = this.builtinModules.get(name)
								if (builtinModule !== undefined) {
									// 无可替代实现
									if (!builtinModule) {
										break
									}
									// 首次使用自动下载依赖
									if (!isAbsolutePath(builtinModule)) {
										builtinModule = await this.requireResolve(builtinModule)
										this.builtinModules.set(name, builtinModule)
									}
									dependency.module = this.getModule(builtinModule)
									if (dependency.module.state === ModuleState.initial) {
										this._loadModule(dependency.module)
									}
									break
								}
								// 解析 node_modules
								const containingDir = getDir(module.originalPath)
								resolvedPath = await resolver.resolver.resolve(name, containingDir)
								if (resolvedPath === null) {
									// 自动安装模块
									if (this.autoInstallModules) {
										await this.installPackage(name)
									}
									const resolveContext: ResolveContext = { trace: [] }
									resolvedPath = await resolver.resolver.resolve(name, containingDir, resolveContext)
									if (resolvedPath === null) {
										this.emit("moduleNotFound", name, dependency, module)
										detail = resolveContext.trace!.join("\n")
									}
								}
							} else if (await this.fs.existsFile(dependency.name = resolvedPath = resolvePath(module.originalPath, "..", name))) {
								if (resolver.enforceCaseSensitive && this.fs.isCaseInsensitive) {
									const realPath = await this.fs.getRealPath(resolvedPath) || resolvedPath
									if (relativePath(this.rootDir, realPath) !== relativePath(this.rootDir, resolvedPath)) {
										module.addWarning({
											source: i18n`Resolver`,
											message: i18n`The casing of url '${this.logger.formatPath(resolvedPath)}' differs to '${this.logger.formatPath(realPath)}'`,
											detail: detail,
											line: dependency.line,
											column: dependency.column,
											endLine: dependency.endLine,
											endColumn: dependency.endColumn,
											index: dependency.index,
											endIndex: dependency.endIndex,
										})
									}
								}
							} else {
								this.emit("moduleNotFound", dependency, module)
								resolvedPath = null
							}
							dependency.path = resolvedPath
							if (resolver.after) {
								resolver.after(dependency, module, this)
							}
							if (resolvedPath) {
								dependency.module = this.getModule(resolvedPath)
								if (dependency.module.state === ModuleState.initial) {
									this._loadModule(dependency.module)
								}
							} else if (resolvedPath == null) {
								const logEntry: ModuleLogEntry = {
									source: i18n`Resolver`,
									message: resolver.resolver ? i18n`Cannot find module '${name}'` : i18n`Cannot find file '${this.logger.formatPath(dependency.name as string)}'`,
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
				if (module.state !== ModuleState.loading) {
					return
				}
			}
			// 完成加载
			if (!module.type) {
				module.type = bundler && bundler.type || this.getMimeType(module.ext)
			}
			module.state = ModuleState.loaded
			// 监听外部模块
			if (this.watcher && !module.isEntryModule) {
				this.watcher.add(module.originalPath)
			}
			this.emit("loadModule", module)
		} catch (e) {
			module.addError(e)
		} finally {
			this._loadDeferred.resolve()
		}
		await this.reportErrorAndWarnings(module)
	}

	/** 获取所有 MIME 类型 */
	readonly mimeTypes = new Map<string, string>()

	/** 获取指定扩展名对应的 MIME 类型 */
	getMimeType(ext: string) {
		return this.mimeTypes.get(ext) || "application/octet-stream"
	}

	// #endregion

	// #region 处理模块

	/** 获取第一个编译器 */
	readonly compilerRoot?: ResolvedProcessorRule

	/** 获取第一个优化器 */
	readonly optimizerRoot?: ResolvedProcessorRule

	/** 获取多核并行处理器个数 */
	readonly parallel: number // todo

	/**
	 * 使用指定的处理器处理模块
	 * @param processor 要使用的处理器
	 * @param module 要处理的模块
	 */
	private async _processModule(processor: ResolvedProcessorRule | undefined, module: Module) {
		const state = module.state
		while (processor) {
			// 跳过不匹配的处理器
			if (processor.matcher && !processor.matcher.test(module.path)) {
				processor = processor.nextFalse
				continue
			}
			// 只有首次用到才加载处理器
			if (!processor.processor) {
				if (processor.use) {
					try {
						let factory = processor.use!
						if (typeof factory === "string") {
							factory = await this.require(factory) as ProcessorFactory
							// 支持 ES6 模块
							if (typeof factory !== "function" && (factory as any).__esModule) {
								factory = (factory as any).default as ProcessorFactory
								if (typeof factory !== "function") {
									throw i18n`Plugin '${processor.use}' does not default export a function`
								}
							}
						}
						// 如果有多个模块都需要使用此处理器，第一次会加载处理器并创建处理器实例，下一次只需等待
						if (!processor.processor) {
							processor.processor = new factory(processor.options, this)
							if (factory.name) {
								processor.name = factory.name
							}
						}
					} catch (e) {
						// 避免重复报告插件加载失败的错误
						if (!processor.processor) {
							processor.processor = {
								read: false,
								process(module) {
									module.addWarning({
										message: i18n`Skipped because cannot load plugin '${processor!.name}': ${e.message}`,
										error: e
									})
								}
							}
						}
						module.addError({
							message: i18n`Skipped because cannot load plugin '${processor.name}': ${e.message}`,
							error: e,
							showErrorStack: true
						})
						return
					}
					if (module.state !== state) {
						return
					}
				} else {
					processor.processor = { read: false, process() { } }
				}
			}
			// 读取模块内容
			if (module.data === undefined && processor.processor.read !== false) {
				if (!await this._readModule(module, processor.processor.read === "text", processor.name)) {
					return
				}
				if (module.state !== state) {
					return
				}
			}
			// 处理模块
			const processingTask = this.logger.begin(`${color(processor.name, ConsoleColor.brightCyan)} ${this.logger.formatPath(module.originalPath)}`)
			try {
				await processor.processor.process(module, this)
			} catch (e) {
				module.addError({
					source: processor.name,
					error: e,
					showErrorStack: true
				})
				break
			} finally {
				this.logger.end(processingTask)
			}
			if (module.state !== state || module.hasErrors) {
				break
			}
			// 计算输出路径
			if (processor.outPath) {
				module.path = this.resolvePath(processor.outPath(module, this))
			}
			processor = processor.nextTrue
		}
	}

	/** 获取读取文本文件内容时，默认使用的文件编码 */
	readonly encoding: string

	/**
	 * 读取模块的内容
	 * @param module 要读取的模块
	 * @param text 是否以文本方式读取
	 * @param source 读取的来源
	 * @returns 如果读取成功则返回 `true`，否则返回 `false`
	 */
	private async _readModule(module: Module, text: boolean, source: string) {
		const readingTask = this.logger.begin(`${color(i18n`Reading`, ConsoleColor.brightCyan)} ${this.logger.formatPath(module.originalPath)}`)
		try {
			if (text) {
				module.data = await this.fs.readFile(module.originalPath, this.encoding)
			} else {
				module.data = await this.fs.readFile(module.originalPath)
			}
		} catch (e) {
			module.addError({
				source: source,
				message: i18n`Cannot read file: ${e.message}`,
				error: e
			})
			return false
		} finally {
			this.logger.end(readingTask)
		}
		return true
	}

	// #endregion

	// #region 生成模块

	/**
	 * 生成指定的模块
	 * @param module 要生成的模块
	 * @param read 是否读取模块内容
	 * - `"text"`（默认）: 使用全局设置的编码读取模块内容
	 * - `true`/`"binary"`: 读取二进制数据
	 * - `false`: 不读取模块内容
	 */
	async emitModule(module: Module, read?: boolean | "text" | "binary") {
		// 读取模块内容
		if (module.data === undefined && read) {
			await this._readModule(module, read === "text", "Emit")
		}
		// 打包器会调用此函数生成依赖，如果依赖已生成或正在生成，则不重复生成
		// 一般地，只有模块有循环依赖时，才会出现一个状态为“正在生成”的模块
		if (module.state === ModuleState.loaded) {
			await this._emitModule(module)
		}
	}

	/** 提取外部模块的规则 */
	readonly externalModules: {
		/** 匹配的模块匹配器 */
		matcher?: Matcher
		/** 匹配的 MIME 类型 */
		matchType?: string
		/** 提取的最小字节大小  */
		minSize: number
		/**
		 * 获取提取的路径的回调函数
		 * @param module 待提取的模块
		 * @param builder 当前的构建器对象
		 */
		outPath: (module: Module, builder: Builder) => string
	}[]

	/** 判断是否跳过检查输出的路径，即是否允许生成的模块保存到 `outDir` 外、生成的模块覆盖源模块 */
	readonly noPathCheck: boolean

	/** 获取生成的所有模块，键为生成模块的绝对路径，值为对应的模块对象 */
	readonly emittedModules = new Map<string, Module>()

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
		readonly url?: (sourceMapPath: string, module: Module, builder: Builder) => string | false | null
		/** 判断是否将源映射内联到生成的模块中 */
		readonly inline: boolean
	}

	/**
	 * 生成指定的模块
	 * @param module 要生成的模块
	 */
	private async _emitModule(module: Module) {
		try {
			// 避免重复生成
			module.state = ModuleState.emitting
			// 生成模块
			const bundler = module.bundler
			if (bundler) {
				const generatingTask = this.logger.begin(`${color(i18n`Generating`, ConsoleColor.brightCyan)} ${this.logger.formatPath(module.originalPath)}`)
				try {
					await bundler.generate(module, this)
				} catch (e) {
					module.addError({
						source: i18n`Bundler`,
						error: e,
						showErrorStack: true
					})
				} finally {
					this.logger.end(generatingTask)
				}
			}
			// 优化模块
			if (this.optimizerRoot && !module.hasErrors) {
				await this._processModule(this.optimizerRoot, module)
			}
			// 计算路径
			if (!module.noEmit) {
				// 计算路径
				if (!module.isEntryModule) {
					module.noEmit = true
					for (const externalModule of this.externalModules) {
						if (externalModule.matcher && !externalModule.matcher.test(module.path)) {
							continue
						}
						if (externalModule.matchType && !(module.type || this.getMimeType(module.ext)).startsWith(externalModule.matchType + "/")) {
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
						module.path = this.resolvePath(externalModule.outPath(module, this))
						module.noEmit = false
						break
					}
				}
				// 添加生成模块
				this._addToEmittedModules(module)
				// 计算源映射
				// FIXME: 支持内联模块的源映射？
				if (this.sourceMap) {
					const originalMap = module.sourceMapObject
					if (originalMap) {
						// 空闲/快速模块：源映射必须生成在最终文件旁边
						const fixedPath = this.devServer && this.devServer.mode !== DevServerMode.normal
						const mapPath = fixedPath ? module.path + ".map" : this.sourceMapOptions.inline ? module.path : this.sourceMapOptions.outPath ? this.resolvePath(this.sourceMapOptions.outPath(module, this)) : module.path + ".map"
						const mapObject = {
							version: originalMap.version || 3
						} as SourceMapObject
						if (this.sourceMapOptions.includeFile) {
							mapObject.file = relativePath(getDir(mapPath), module.path)
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
											this.relativePath(originalMap.sources[i]) :
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
						const mapString = module.sourceMap = JSON.stringify(mapObject, undefined, this.sourceMapOptions.indent)
						const mapURL = this.sourceMapOptions.inline ?
							encodeDataURI("application/json", mapString) :
							this.sourceMapOptions.url ? this.sourceMapOptions.url(mapPath, module, this) : relativePath(getDir(module.path), mapPath)
						if (mapURL) {
							if (module.data === undefined) {
								await this._readModule(module, true, "SourceMap")
							}
							module.content += createSourceMappingURLComment(mapURL, module.type === "text/javascript")
						}
						if (!this.sourceMapOptions.inline && !fixedPath) {
							module.addSibling(mapPath, mapString)
						}
					}
				}
			}
			// 生成依赖
			if (module.siblings) {
				for (const sibling of module.siblings) {
					if (!sibling.type) sibling.type = this.getMimeType(getExt(sibling.path))
					this._addToEmittedModules(sibling)
				}
			}
			module.emitTime = Date.now()
			module.state = ModuleState.emitted
			if (module.references) {
				for (const reference of module.references) {
					this.addReference(module, reference)
				}
			}
			this.emit("emitModule", module)
		} catch (e) {
			module.addError(e)
		}
		await this.reportErrorAndWarnings(module)
	}

	/**
	 * 添加一个模块到生成列表
	 * @param module 生成的模块
	 */
	private _addToEmittedModules(module: Module) {
		const sourceModule = module.sourceModule || module
		// 检查路径
		if (!this.noPathCheck) {
			if (module.data != undefined && pathEquals(sourceModule.originalPath, this.getOutputPath(module.path), this.fs.isCaseInsensitive)) {
				module.noEmit = true
				sourceModule.addError(i18n`Cannot overwrite source file`)
				return
			}
			if (!containsPath(this.rootDir, module.path, this.fs.isCaseInsensitive)) {
				module.noEmit = true
				sourceModule.addError(i18n`Cannot write files outside the outDir '${this.logger.formatPath(this.outDir)}': '${module.path}'`)
				return
			}
		}
		// 检查路径冲突
		const exists = this.emittedModules.get(module.path)
		if (exists && exists.state !== ModuleState.deleted) {
			if (exists !== module) {
				module.noEmit = true
				sourceModule.addError(i18n`Output path conflicts with '${this.logger.formatPath((exists.sourceModule || exists).originalPath)}': '${module.path}'`)
			}
			return
		}
		// 添加模块
		this.emittedModules.set(module.path, module)
	}

	// #endregion

	// #region 保存模块

	/**
	 * 保存指定的模块
	 * @param module 要保存的模块
	 */
	private async _writeModule(module: Module) {
		// 保存兄弟文件
		if (module.siblings) {
			for (const sibling of module.siblings) {
				this._writeModule(sibling)
			}
		}
		// 允许插件跳过保存当前模块
		if (module.noEmit) {
			return
		}
		// 保存文件
		const path = this.getOutputPath(module.path)
		if (module.data !== undefined) {
			const writingTask = this.logger.begin(`${color(i18n`Writing`, ConsoleColor.brightCyan)} ${this.logger.formatPath(module.originalPath)}`)
			try {
				await this.fs.writeFile(path, module.data)
			} catch (e) {
				module.addError({
					message: `Cannot write file: ${e.message}`,
					error: e
				})
			} finally {
				this.logger.end(writingTask)
			}
		} else if (!pathEquals(module.originalPath, path, this.fs.isCaseInsensitive)) {
			const copyingTask = this.logger.begin(`${color(i18n`Copying`, ConsoleColor.brightCyan)} ${this.logger.formatPath(module.originalPath)}`)
			try {
				await this.fs.copyFile(module.originalPath, path)
			} catch (e) {
				module.addError({
					message: `Cannot copy file: ${e.message}`,
					error: e
				})
			} finally {
				this.logger.end(copyingTask)
			}
		}
		this.emit("writeModule", module)
		await this.reportErrorAndWarnings(module)
	}

	/**
	 * 计算一个绝对路径的最终输出绝对路径
	 * @param path 要计算的绝对路径
	 */
	getOutputPath(path: string) {
		return setDir(path, this.outDir, this.rootDir)
	}

	// #endregion

	// #region 错误和警告

	/** 判断是否在出现第一个错误后终止构建 */
	readonly bail: boolean

	private readonly errorModules = new Map<Module, string[]>()

	/**
	 * 报告指定模块新产生的错误和警告
	 * @param module 要处理的模块
	 */
	protected async reportErrorAndWarnings(module: Module) {
		if (module.errors) {
			for (let i = module.reportedErrorCount; i < module.errors.length; i++) {
				const logEntry = module.errors[i]
				if (logEntry.line != undefined && logEntry.content == undefined && logEntry.fileName != undefined && this.logger.codeFrame && logEntry.codeFrame == undefined) {
					try {
						logEntry.content = await this.fs.readFile(logEntry.fileName, this.encoding)
					} catch (e) {
						this.logger.debug(e)
					}
				}
				module.reportedErrorCount++
				if (!this.emit("buildError", logEntry, module)) {
					continue
				}
				if (this.bail) {
					throw new Error(i18n`Error found in '${logEntry.fileName}': ${logEntry.message || ""}`)
				}
				this.logger.error(logEntry)
			}
		}
		if (module.warnings) {
			for (let i = module.reportedWarningCount; i < module.warnings.length; i++) {
				const logEntry = module.warnings[i]
				if (logEntry.line != undefined && logEntry.content == undefined && logEntry.fileName != undefined && this.logger.codeFrame && logEntry.codeFrame == undefined) {
					try {
						logEntry.content = await this.fs.readFile(logEntry.fileName, this.encoding)
					} catch (e) {
						this.logger.debug(e)
					}
				}
				module.reportedWarningCount++
				if (!this.emit("buildWarning", logEntry, module)) {
					continue
				}
				this.logger.warning(logEntry)
			}
		}
	}

	// #endregion

	// #region 安装模块

	/** 判断是否自动安装模块 */
	readonly autoInstallModules: boolean

	/**
	 * 载入一个本地模块
	 * @param module 要载入的模块
	 * @param autoInstallModules 是否自动安装模块
	 */
	async require(module: string, autoInstallModules = this.autoInstallModules) {
		return require(await this.requireResolve(module, autoInstallModules))
	}

	/**
	 * 解析本地模块对应的路径
	 * @param module 要载入的模块
	 * @param autoInstallModules 是否自动安装模块
	 */
	async requireResolve(module: string, autoInstallModules = this.autoInstallModules) {
		return await resolveFrom(module, this.baseDir, autoInstallModules ? this.installCommand : undefined, this.logger)
	}

	/** 获取用于安装模块的命令，其中 `<module>` 会被替换为实际的模块名 */
	readonly installCommand: string

	/**
	 * 安装一个包
	 * @param name 要安装的包名
	 * @returns 如果安装成功则返回 `true`，否则说明模块路径错误或安装命令退出状态码非 0，返回 `false`
	 */
	installPackage(name: string) {
		return installPackage(name, this.baseDir, this.installCommand, this.logger)
	}

	// #endregion

	// #region 报告

	/**
	 * 构建完成后的报告器
	 * @param result 包含构建结果的对象
	 * @param builder 当前的构建器对象
	 */
	readonly reporter?: (result: BuildResult, builder: Builder) => void

	/**
	 * 概述报告器
	 * @param result 包含构建结果的对象
	 * @param builder 当前的构建器对象
	 */
	summaryReporter(result: BuildResult) {
		const log = i18n`${result.errorCount ? color(i18n`Build completed!`, ConsoleColor.brightCyan) : color(i18n`Build success!`, ConsoleColor.brightGreen)}(error: ${color(result.errorCount.toString(), result.errorCount > 0 ? ConsoleColor.brightRed : ConsoleColor.brightBlack)}, warning: ${color(result.warningCount.toString(), result.warningCount > 0 ? ConsoleColor.brightYellow : ConsoleColor.brightBlack)}, file: ${this.emittedModules.size}, elapsed: ${result.elapsedTime[0] > 60 ? color(result.elapsedTimeString, ConsoleColor.brightYellow) : result.elapsedTimeString})`
		if (result.errorCount) {
			this.logger.fatal(log)
		} else {
			this.logger.success(log)
		}
	}

	/**
	 * 详情报告器
	 * @param result 包含构建结果的对象
	 * @param builder 当前的构建器对象
	 */
	detailReporter(result: BuildResult) {
		// todo
	}

	// #endregion

}

// #region 选项

/** 表示构建器的选项 */
export interface BuilderOptions {

	// #region 输入输出

	/**
	 * 需要构建的源文件夹，源文件内所有文件都会被构建并生成到目标文件夹
	 * @default "src"
	 */
	rootDir?: string
	/**
	 * 生成的目标文件夹，目标文件夹会在构建时被自动创建
	 * @default "dist"
	 */
	outDir?: string
	/**
	 * 指定源文件夹中哪些文件才需要构建，可以是通配符或正则表达式等，默认为所有非点开头的文件
	 * @default "*"
	 */
	match?: Pattern
	/**
	 * 指定源文件夹中哪些文件不需要构建，可以是通配符或正则表达式等
	 * @description > 注意即使文件被排除了，如果它被其它文件依赖，仍会被当成外部模块参与构建
	 * @default ["**‌/node_modules/**‌"]
	 */
	exclude?: Pattern

	// #endregion

	// #region 打包

	/** 指定应该如何编译不同类型的模块 */
	compilers?: ProcessorRule[]
	/** 指定应该如何打包模块依赖 */
	bundler?: {
		/** 指定打包的目标 */
		target?: "web" | "node"
		/** 指定如何解析依赖的路径，比如将 `react` 解析成 `node_modules` 下的绝对路径 */
		resolver?: ResolverRule | ResolverRule[]
		/** 外部的模块（如 `node_modules`）将按此规则拷贝到项目中，如果不匹配任一规则，则外部模块将内联（如 base64）到引用的模块中 */
		externalModules?: ExternalModuleRule[]

		/** 打包 JavaScript 文件的附加选项 */
		js?: JSBundlerOptions
		/** 打包 CSS 文件的附加选项 */
		css?: CSSBundlerOptions
		/** 打包 HTML 文件的附加选项 */
		html?: HTMLBundlerOptions

		/** 指定如何合并依赖生成最终的代码 */
		output?: OutputOptions

		/** 指定应该如何打包不同扩展名的模块，键为扩展名（含点），值为打包器构造函数或实例，如果设为 `false` 则不打包此类型 */
		bundlers?: { [ext: string]: (new (options: any, builder: Builder) => Bundler) | Bundler | false }
		/**
		 * 用于标记内联引用模块的查询参数名，如果为 false 型则不自动根据查询参数内联
		 * @default "inline"
		 */
		inlineQuery?: string | false
		/**
		 * 用于标记不解析指定路径的查询参数名，如果为 false 型则不自动根据查询参数跳过地址
		 * @default "ignore"
		 */
		noCheckQuery?: string | false
		/**
		 * 配置解析模块时内置的模块路径，如果路径为 false 型表示忽略该内置模块
		 * @description 比如 Node 内置的模块，可在此设置别名路径
		 */
		builtinModules?: { [name: string]: string | false }
		/** 配置各扩展名对应的 MIME 类型 */
		mimeTypes?: { [ext: string]: string }
	}
	/**
	 * 是否启用优化
	 * @default process.env.NODE_ENV === "production"
	 */
	optimize?: boolean
	/** 指定应该如何优化不同类型的模块 */
	optimizers?: ProcessorRule[]

	// #endregion

	// #region 开发服务

	/**
	 * 是否在全量构建前清理目标文件夹
	 * @description 注意如果生成文件夹等同于或包含了源文件夹，则清理选项会被自动禁用
	 * @default true
	 */
	clean?: boolean
	/**
	 * 生成源映射（Source Map）的选项，`false` 表示不生成，`true` 表示按默认配置生成
	 * @default !this.optimize
	 */
	sourceMap?: boolean | {
		/**
		 * 指定源映射的生成路径，如果是字符串，则其中以下标记会被替换：
		 * - `<path>`: 源模块的相对路径，等价于 `<dir>/<name><ext>`
		 * - `<dir>`: 源模块所在文件夹的相对路径
		 * - `<name>`: 源模块的文件名（不含文件夹和扩展名部分）
		 * - `<ext>`: 源模块的扩展名（含点）
		 * - `<md5>`: 源模块内容的 MD5 串（小写），默认截取前 8 位，如果要截取前 n 位，使用 `<md5:n>`
		 * - `<sha1>`: 源模块内容的 SHA-1 串（小写），默认截取前 8 位，如果要截取前 n 位，使用 `<sha1:n>`
		 * - `<date>`: 当前时间，默认为用户本地可读格式，如果要自定义格式，使用如 `<date:yyyyMMdd>`
		 * - `<random>`: 随机整数，默认为 8 位，如果要自定义为 n  位，使用如 `<rand:n>`
		 * - `<builder>`: 构建器的名字，默认为 `TPack`
		 * - `<version>`: 构建器的版本号
		 * @param module 所属的模块
		 * @param builder 当前的构建器对象
		 * @default "<path>.map"
		 */
		outPath?: string | ((module: Module, builder: Builder) => string)
		/**
		 * 源映射中引用源模块的根地址
		 * @example "file:///"
		 */
		sourceRoot?: string
		/**
		 * 获取源映射中引用每个源文件地址的回调函数
		 * @param sourcePath 源文件的绝对路径
		 * @param sourceMapPath 源映射的绝对路径
		 * @param module 所属的模块
		 * @param builder 当前的构建器对象
		 */
		source?: (sourcePath: string, sourceMapPath: string, module: Module, builder: Builder) => string
		/**
		 * 获取每个源模块内容的回调函数
		 * @param sourcePath 源模块绝对路径
		 * @param sourceMapPath 源映射绝对路径
		 * @param module 源模块对象
		 * @param builder 当前的构建器对象
		 */
		sourceContent?: (sourcePath: string, sourceMapPath: string, module: Module, builder: Builder) => string | Promise<string>
		/**
		 * 是否在源映射中内联源内容
		 * @default false
		 */
		includeSourcesContent?: boolean
		/**
		 * 是否在源映射中包含生成文件名字段
		 * @default true
		 */
		includeFile?: boolean
		/**
		 * 是否在源映射中包含符号名称字段
		 * @default true
		 */
		includeNames?: boolean
		/**
		 * 格式化源映射 JSON 时的缩进字符串或缩进空格数，如果为空或 0 则压缩成一行
		 * @default 0
		 */
		indent?: string | number
		/**
		 * 在生成的模块中插入的指向源映射的地址注释
		 * - `true`（默认）: 使用基于 `outPath` 计算的地址
		 * - `false` 不插入注释
		 * @param sourceMapPath 源映射的最终绝对路径
		 * @param module 源模块对象
		 * @param builder 当前构建器的对象
		 * @default true
		 */
		url?: boolean | ((sourceMapPath: string, module: Module, builder: Builder) => string | false)
		/**
		 * 是否将源映射使用 Base64 编码内联到生成的模块中
		 * @default false
		 */
		inline?: boolean
	}
	/**
	 * 是否在出现第一个错误后终止构建
	 * @default false
	 */
	bail?: boolean
	/** 日志记录器的选项 */
	logger?: Logger | LoggerOptions
	/**
	 * 构建完成后的报告内容
	 * - `"summary"`（默认）: 报告构建结果的概述
	 * - `true`/`"detail"`: 报告完整的构建结果
	 * - `false`/`null`: 不报告
	 * - `(result: BuildResult) => string`: 自定义报告内容
	 * @default "summary"
	 */
	reporter?: "summary" | "detail" | boolean | ((result: BuildResult, builder: Builder) => void)
	/** 是否监听文件改动并主动重新构建 */
	watch?: boolean | WatcherOptions
	/**
	 * 是否启动本地开发服务器
	 * `true`（默认）: 使用默认端口（根据项目名自动决定）启动开发服务器
	 * `false`/`null`: 不启动开发服务器
	 * 数字: 使用指定端口启动开发服务器
	 * 字符串: 使用指定地址启动开发服务器
	 * 对象: 根据对象的配置启动开发服务器
	 */
	devServer?: boolean | number | string | DevServerOptions
	/**
	 * 用于安装模块的命令，其中 `<module>` 会被替换为实际的模块名，如果设为 `false` 则不自动安装模块
	 * @default "npm install <module> --colors"
	 * @example "yarn add <module>"
	 */
	installCommand?: string | false
	/** 配置插件 */
	plugins?: Plugin[]

	// #endregion

	// #region 高级功能

	/**
	 * 工作目录，配置文件中的所有路径都相对于此工作目录，默认为配置文件所在文件夹
	 * @default process.cwd()
	 */
	baseDir?: string
	/**
	 * 配置中所有通配符的选项
	 */
	glob?: PatternOptions
	/** 筛选本次需要构建的文件，可以是通配符或正则表达式等，默认为所有非点开头的文件 */
	filter?: Pattern
	/**
	 * 读取文本文件内容时，默认使用的文件编码
	 * @description 默认仅支持 `utf8`，如果需要支持其它编码，需安装相应依赖库
	 * @default "utf-8"
	 */
	encoding?: string
	/**
	 * 如果设为 `true`，则允许生成的模块保存到生成文件夹外或者让生成的文件覆盖源文件
	 * @default false
	 */
	noPathCheck?: boolean
	/**
	 * 是否仅构建但不实际生成文件，可用于验证代码是否有错但不影响任何文件
	 * @default false
	 */
	noWrite?: boolean
	/**
	 * 多核并行构建的进程数
	 * @default 1
	 */
	parallel?: number
	/** 使用的文件系统，可以自定义文件系统实现虚拟构建 */
	fs?: FileSystem

	// #endregion

	/** 允许扩展自定义属性 */
	[key: string]: any

}

/** 表示一个模块处理器 */
export interface Processor {
	/**
	 * 在使用当前处理器处前是否需要读取模块内容
	 * - `"text"`（默认）: 使用全局设置的编码读取模块内容
	 * - `true`/`"binary"`: 读取二进制数据
	 * - `false`: 不读取模块内容
	 */
	read?: boolean | "binary" | "text"
	/**
	 * 负责处理单个模块
	 * @param module 要处理的模块
	 * @param builder 当前的构建器对象
	 */
	process(module: Module, builder: Builder): void | Promise<void>
}

/** 表示一个处理器规则 */
export interface ProcessorRule extends Partial<Processor> {
	/**
	 * 指定哪些模块可以使用此处理器处理，可以是通配符或正则表达式等
	 * @default "*"
	 */
	match?: Pattern
	/** 指定额外排除的模块，可以是通配符或正则表达式等 */
	exclude?: Pattern
	/** 指定使用的处理器，可以是待加载的插件路径或多个处理器组合 */
	use?: string | ProcessorFactory | (ProcessorRule | undefined | null)[]
	/** 传递给处理器的附加选项 */
	options?: any
	/**
	 * 当前处理器输出的模块路径，如果是字符串，则其中以下标记会被替换：
	 * - `<path>`: 模块的相对路径，等价于 `<dir>/<name><ext>`
	 * - `<dir>`: 模块所在文件夹的相对路径
	 * - `<name>`: 模块的文件名（不含文件夹和扩展名部分）
	 * - `<ext>`: 模块的扩展名（含点）
	 * - `<md5>`: 模块内容的 MD5 串（小写），默认截取前 8 位，如果要截取前 n 位，使用 `<md5:n>`
	 * - `<sha1>`: 模块内容的 SHA-1 串（小写），默认截取前 8 位，如果要截取前 n 位，使用 `<sha1:n>`
	 * - `<date>`: 当前时间，默认为用户本地可读格式，如果要自定义格式，使用如 `<date:yyyyMMdd>`
	 * - `<random>`: 随机整数，默认为 8 位，如果要自定义为 n  位，使用如 `<rand:n>`
	 * - `<builder>`: 构建器的名字，默认为 `TPack`
	 * - `<version>`: 构建器的版本号
	 * @param module 当前模块
	 * @param builder 当前的构建器
	 * @returns 返回相对于目标文件夹的相对路径
	 */
	outPath?: string | ((module: Module, builder: Builder) => string)
	/** 是否跳过后续同级处理器 */
	break?: boolean
}

/** 表示一个模块处理器构造函数 */
export interface ProcessorFactory {
	/**
	 * 初始化新的处理器
	 * @param options 附加选项
	 * @param builder 当前的构建器对象
	 */
	new(options: any, builder: Builder): Processor
	/** 获取当前处理器的名称，提供友好的名称方便用户定位问题 */
	name: string
	/**	判断当前处理器是否支持在其它进程同时执行 */
	parallel?: boolean
	/**	判断当前处理器是否允许缓存处理结果 */
	cachable?: boolean
}

/** 表示一个解析器规则 */
export interface ResolverRule extends ResolverOptions {
	/**
	 * 指定哪些模块可以按此规则解析，可以是通配符或正则表达式等
	 * @default "*"
	 */
	match?: Pattern
	/** 指定额外排除的模块，可以是通配符或正则表达式等 */
	exclude?: Pattern
	/**
	 * 解析路径的方式
	 * - `"relative"`: 采用相对地址解析
	 * - `"node"`: 采用和 Node.js 中 `require` 相同的方式解析
	 */
	type?: "relative" | "node"
	/**
	 * 在解析模块路径之前的回调函数
	 * @param dependency 要解析的依赖对象
	 * @param containingModule 当前地址所在的模块
	 * @param builder 当前的构建器对象
	 */
	before?: (dependency: Dependency, containingModule: Module, builder: Builder) => void
	/**
	 * 在解析模块路径之后的回调函数
	 * @param dependency 要解析的依赖对象
	 * @param containingModule 当前地址所在的模块
	 * @param builder 当前的构建器对象
	 */
	after?: (dependency: Dependency, containingModule: Module, builder: Builder) => void
}

/** 表示将外部模块复制到项目中的规则 */
export interface ExternalModuleRule {
	/**
	 * 指定哪些外部模块可以按此规则复制到项目中，可以是通配符或正则表达式等
	 * @default "*"
	 */
	match?: Pattern
	/** 指定额外排除的模块，可以是通配符或正则表达式等 */
	exclude?: Pattern
	/**
	 * 根据 MIME 类型指定哪些外部模块可以按此规则复制到项目中
	 * @example "image"
	 */
	matchType?: string
	/** 只有当模块的字节大小超过此值才会提取  */
	minSize?: number
	/**
	 * 复制到项目中的路径，如果是字符串，则其中以下标记会被替换：
	 * - `<path>`: 模块的相对路径，等价于 `<dir>/<name><ext>`
	 * - `<dir>`: 模块所在文件夹的相对路径
	 * - `<name>`:模块的文件名（不含文件夹和扩展名部分）
	 * - `<ext>`: 模块的扩展名（含点）
	 * - `<md5>`: 模块内容的 MD5 串（小写），默认截取前 8 位，如果要截取前 n 位，使用 `<md5:n>`
	 * - `<sha1>`: 模块内容的 SHA-1 串（小写），默认截取前 8 位，如果要截取前 n 位，使用 `<sha1:n>`
	 * - `<date>`: 当前时间，默认为用户本地可读格式，如果要自定义格式，使用如 `<date:yyyyMMdd>`
	 * - `<random>`: 随机整数，默认为 8 位，如果要自定义为 n  位，使用如 `<rand:n>`
	 * - `<builder>`: 构建器的名字，默认为 `TPack`
	 * - `<version>`: 构建器的版本号
	 * @param module 要复制的外部模块对象
	 * @param builder 当前的构建器对象
	 * @returns 返回相对于目标文件夹的相对路径
	 */
	outPath: string | ((module: Module, builder: Builder) => string)
}

/** 表示一个插件 */
export interface Plugin {
	/**
	 * 应用指定的插件
	 * @param builder 当前的构建器对象
	 */
	apply(builder: Builder): void
}

// #endregion

/** 表示一个已解析的处理器规则 */
export interface ResolvedProcessorRule {
	/** 当前处理器的名字 */
	name: string
	/** 需要处理的文件路径的匹配器 */
	matcher?: Matcher
	/** 处理器实例 */
	processor?: Processor
	/** 要使用的处理器路径或构造函数 */
	use?: string | ProcessorFactory
	/** 传递给处理器的附加选项 */
	options?: any
	/**
	 * 获取当前处理器输出的路径
	 * @param module 要重命名的模块
	 * @param builder 当前的构建器对象
	 */
	outPath?: (module: Module, builder: Builder) => string
	/** 当匹配此处理器后的下一个处理器 */
	nextTrue?: ResolvedProcessorRule
	/** 当不匹配此处理器后的下一个处理器 */
	nextFalse?: ResolvedProcessorRule
}

/** 表示一个模块打包器 */
export interface Bundler {
	/** 获取或设置模块的 MIME 类型 */
	type?: string
	/**
	 * 在使用当前处理器处前是否需要读取模块内容
	 * - `"text"`（默认）: 使用全局设置的编码读取模块内容
	 * - `true`/`"binary"`: 读取二进制数据
	 * - `false`: 不读取模块内容
	 */
	read?: boolean | "binary" | "text"
	/**
	 * 解析指定的模块
	 * @param module 要解析的模块
	 * @param builder 当前构建器实例
	 */
	parse(module: Module, builder: Builder): void | Promise<void>
	/**
	 * 计算模块的打包结果
	 * @param modules 所有入口模块
	 * @param builder 当前构建器实例
	 */
	bundle?(modules: Module[], pathOnly: boolean, builder: Builder): void | Promise<void>
	/**
	 * 生成指定的模块
	 * @param module 要生成的模块
	 * @param builder 当前构建器实例
	 */
	generate(module: Module, builder: Builder): void | Promise<void>
}

/** 表示一个构建结果 */
export class BuildResult {

	/** 获取本次构建的开始时间 */
	startTime = process.hrtime()

	/** 获取本次构建的所有入口模块 */
	entryModules: Module[] = []

	/** 获取本次构建累积错误的个数 */
	errorCount = 0

	/** 获取本次构建累积警告的个数 */
	warningCount = 0

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