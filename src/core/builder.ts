import { CSSBundler, CSSBundlerOptions } from "../bundlers/css"
import { HTMLBundler, HTMLBundlerOptions } from "../bundlers/html"
import { JSBundler, JSBundlerOptions } from "../bundlers/js"
import { ConsoleColor, color } from "../utils/ansi"
import { encodeDataUri } from "../utils/base64"
import { EventEmitter } from "../utils/eventEmitter"
import { FileSystem } from "../utils/fileSystem"
import { Matcher, Pattern, PatternOptions } from "../utils/matcher"
import { copyToMap, formatDate, formatHRTime, insertOrdered } from "../utils/misc"
import { appendFileName, containsPath, getDir, isAbsolutePath, normalizePath, pathEquals, relativePath, resolvePath, setDir } from "../utils/path"
import { exec, ExecResult } from "../utils/process"
import { createSourceMappingURLComment, SourceMapObject } from "../utils/sourceMap"
import { isAbsoluteURL } from "../utils/url"
import { DevServerOptions } from "./devServer"
import { i18n } from "./i18n"
import { Logger, LoggerOptions, LogLevel } from "./logger"
import { Module, ModuleLogEntry, ModuleState } from "./module"
import { ResolveContext, Resolver, ResolverOptions } from "./resolver"

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
		this.noEmit = !!options.noEmit
		this.parallel = options.parallel || 1
		this.fs = options.fs || new FileSystem()

		this.rootDir = resolvePath(baseDir, options.rootDir != undefined ? options.rootDir : "src")
		this.matcher = this.createMatcher(options.match, options.exclude != undefined ? options.exclude : ["**/node_modules/**", "**/package.json"])
		this.outDir = resolvePath(baseDir, options.outDir != undefined ? options.outDir : "dist")

		this.compilerRoot = resolveProcessorRules.call(this, options.compilers || require("../../configs/compilers.json"), "compilers")
		this.optimizerRoot = options.optimize ? resolveProcessorRules.call(this, options.optimizers || require("../../configs/optimizers.json"), "optimizers") : undefined

		const bundlerOptions = options.bundler || {}
		this.resolvers = (Array.isArray(bundlerOptions.resolver) ? bundlerOptions.resolver : [{
			match: "**/node_modules/**/*.js",
			extensions: [".js", ".json"]
		}, {
			match: "**/*.js",
			...bundlerOptions.resolver
		}]).map(resolver => ({
			matcher: resolver.match != undefined && resolver.exclude != undefined ? this.createMatcher(resolver.match || (() => true), resolver.exclude) : undefined,
			before: resolver.before,
			after: resolver.after,
			resolver: resolver.type === "relative" ? undefined : new Resolver(resolver)
		}))
		this.externalModules = (bundlerOptions.externalModules || require("../../configs/externalModules.json") as ExternalModuleRule[]).map(externalModule => ({
			matcher: externalModule.match != undefined && externalModule.exclude != undefined ? this.createMatcher(externalModule.match || (() => true), externalModule.exclude) : undefined,
			matchType: externalModule.matchType,
			minSize: externalModule.minSize || 0,
			outPath: typeof externalModule.outPath === "string" ? (module: Module, builder: Builder) => {
				const originalOutPath = resolvePath(builder.outDir, builder.formatPath(externalModule.outPath as string, module))
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
		const outputOptions = bundlerOptions.output
		this.output = {
			publicURL: outputOptions ? outputOptions.publicURL : undefined,
			relativeURL: outputOptions ? outputOptions.relativeURL : undefined,
			formatURL: outputOptions ? outputOptions.formatURL : undefined,
			prepend: outputOptions ? typeof outputOptions.prepend === "string" ? (module, builder) => builder.formatPath(outputOptions.prepend as string, module) : outputOptions.prepend : undefined,
			append: outputOptions ? typeof outputOptions.append === "string" ? (module, builder) => builder.formatPath(outputOptions.append as string, module) : outputOptions.append : undefined,
			modulePrepend: outputOptions ? typeof outputOptions.modulePrepend === "string" ? (module, _, builder) => builder.formatPath(outputOptions.modulePrepend as string, module) : outputOptions.modulePrepend : undefined,
			moduleAppend: outputOptions ? typeof outputOptions.moduleAppend === "string" ? (module, _, builder) => builder.formatPath(outputOptions.moduleAppend as string, module) : outputOptions.moduleAppend : undefined,
			moduleSeperator: outputOptions && outputOptions.moduleSeperator != undefined ? outputOptions.moduleSeperator : "\n\n",
			indentString: outputOptions && outputOptions.indentString != undefined ? outputOptions.indentString : "  ",
			newLine: outputOptions && outputOptions.indentString != undefined ? outputOptions.indentString : "\n"
		}

		for (const key in bundlerOptions.bundlers) {
			const bundler = bundlerOptions.bundlers[key]
			this.bundlers.set(key, typeof bundler === "function" ? new bundler(bundlerOptions, this) : bundler)
		}
		if (!this.bundlers.has(".js")) this.bundlers.set(".js", new JSBundler(bundlerOptions.js, this))
		if (!this.bundlers.has(".css")) this.bundlers.set(".css", new CSSBundler(bundlerOptions.css, this))
		if (!this.bundlers.has(".html")) this.bundlers.set(".html", new HTMLBundler(bundlerOptions.html, this))

		this.inlineQuery = this.inlineQuery ? this.inlineQuery : this.inlineQuery === undefined ? "inline" : undefined
		this.noCheckQuery = this.noCheckQuery ? this.noCheckQuery : this.noCheckQuery === undefined ? "ignore" : undefined

		copyToMap(require("../../configs/builtinModules.json"), this.builtinModules)
		if (bundlerOptions.builtinModules) {
			copyToMap(bundlerOptions.builtinModules, this.builtinModules)
		}

		copyToMap(require("../../configs/mimeTypes.json"), this.mimeTypes)
		if (bundlerOptions.mimeTypes) {
			copyToMap(bundlerOptions.mimeTypes, this.mimeTypes)
		}

		this.clean = options.clean !== false && !this.noEmit && !containsPath(this.outDir, this.rootDir)
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

		// todo watch
		// todo devServer
		//this.watch = !!options.watch
		// this.devServer = options.devServer

		this.autoInstallModules = !!options.installCommand
		this.installCommand = options.installCommand || "npm install <module> --colors"

		if (options.plugins) {
			for (const plugin of options.plugins) {
				plugin.apply(this)
			}
		}

		/** 初始化所有处理器规则 */
		function resolveProcessorRules(this: Builder, rules: (ProcessorRule | null | undefined)[], name: string, breakTarget?: ResolvedProcessorRule) {
			let last = breakTarget
			for (let i = rules.length - 1; i >= 0; i--) {
				const rule = rules[i]
				if (!rule) {
					continue
				}
				const id = `${name}-${i}`
				const resolved: ResolvedProcessorRule = {
					name: id,
					matcher: rule.match != undefined && rule.exclude != undefined ? this.createMatcher(rule.match || (() => true), rule.exclude) : undefined,
					processor: rule.process ? rule as Processor : undefined
				}
				if (Array.isArray(rule.use)) {
					last = resolveProcessorRules.call(this, rule.use, id, last)
				} else {
					resolved.use = rule.use
					resolved.options = rule.options
				}
				if (rule.outPath != undefined) {
					resolved.outPath = typeof rule.outPath === "string" ? (module, builder) => builder.formatPath(rule.outPath as string, module) : rule.outPath
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
							publicURL: assertString,
							relativeURL(value, name) {
								if (value === "auto" || typeof value === "boolean") {
									return
								}
								errors.push(i18n`'${name}' should be ${"auto"} or of type ${"boolean"}, got ${stringify(value)}`)
							},
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
						printFullPath: assertBoolean,
						baseDir: assertPath,
						codeFrame(value, name) {
							assertBooleanOrObject(value, name, {
								columns: assertNumber,
								rows: assertNumber,
								showLine: assertBoolean,
								showColumn: assertBoolean,
								tab: assertString
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
					interval: assertNumber
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
			encoding: assertString,
			noPathCheck: assertBoolean,
			noEmit: assertBoolean,
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
			if (typeof value === "string" || value instanceof RegExp || typeof value === "function") {
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
				enforceCaseSensitive: relative ? assertNotExists : assertBoolean,
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
	 */
	formatPath(outPath: string, module: Module) {
		return outPath.replace(/<(\w+)(?::(\d+))?>/g, (source, key, argument) => {
			switch (key) {
				case "path":
					return relativePath(this.rootDir, module.path)
				case "dir":
					return relativePath(this.rootDir, module.dir)
				case "name":
					return module.name
				case "ext":
					return module.ext
				case "md5":
					return module.md5.slice(0, parseInt(argument) || 6)
				case "sha1":
					return module.sha1.slice(0, parseInt(argument) || 6)
				case "date":
					return argument ? new Date().toLocaleString() : formatDate(new Date(), argument)
				case "random":
					return Math.floor(10 ** (parseInt(argument) || 6) * Math.random())
				case "builder":
					return this.name
				case "version":
					return this.version
			}
			return source
		})
	}

	/** 获取构建器的名字 */
	get name() {
		return "TPack"
	}

	/** 获取构建器的版本号 */
	get version() {
		return require("../../package").version as string
	}

	// #endregion

	// #region 入口

	/**
	 * 根据配置执行整个构建流程
	 * @param filter 过滤要构建的路径匹配器
	 */
	async run(filter?: Pattern) {
		// todo
		return await this.build(filter)
	}

	// #endregion

	// #region 全量构建

	/** 判断是否在构建前清理生成文件夹 */
	readonly clean: boolean

	/** 判断是否仅构建但不保存模块 */
	readonly noEmit: boolean

	/**
	 * 构建整个项目
	 * @param filter 过滤要构建的路径匹配器
	 * @param pathOnly 是否只处理模块输出路径
	 */
	async build(filter?: Pattern, pathOnly?: boolean) {
		const result = new BuildResult()
		const buildTask = this.logger.begin(i18n`Start building...`)
		try {
			// 第一步：准备开始
			this.on("buildError", recordError)
			this.on("buildWarning", recordWarning)
			this.emit("buildStart", result)
			this.logger.progress(result.progress)

			// 第二步：清理目标文件夹
			if (this.clean && !filter && !pathOnly) {
				const cleanTask = this.logger.begin(i18n`Cleaning '${this.logger.formatPath(this.outDir)}'...`)
				try {
					await this.fs.cleanDir(this.outDir)
				} finally {
					this.logger.end(cleanTask)
				}
			}

			// 第三步：搜索入口模块
			const walkTask = this.logger.begin(i18n`Searching modules...`)
			const entryModules = result.entryModules
			try {
				let matcher = this.matcher
				if (filter) {
					matcher = new Matcher(this.matcher)
					matcher.include(filter, this.globOptions)
				}
				// 全量构建，清理所有模块缓存
				await this.fs.walk(matcher.base || this.rootDir, {
					dir: matcher.excludeMatcher ? path => !matcher.excludeMatcher!.test(path) : undefined,
					file: path => {
						if (matcher.test(path)) {
							const module = this.getModule(path)
							if (pathOnly) {
								module.data = ""
							}
							if (module.isEntryModule) {
								// 为了确保每次打包处理结果完全一致，对 entryModules 的模块按路径排序
								insertOrdered(entryModules, module, (x, y) => x.originalPath <= y.originalPath)
							}
						}
					}
				})
				// 任务数 = 搜索任务 + 所有模块编译任务 + 打包任务 + 所有模块保存任务
				result.doneTaskCount = 1
				result.totalTaskCount = entryModules.length * 2 + 2
				this.logger.progress(result.progress)
			} finally {
				this.logger.end(walkTask)
			}

			// 第四步：编译、解析入口模块及其依赖
			const compileTask = this.logger.begin(i18n`Compiling modules...`)
			try {
				for (const module of entryModules) {
					this._loadModule(module).then(() => {
						result.doneTaskCount++
						this.logger.progress(result.progress)
					})
				}
				if (this._loadPromise) {
					await this._loadPromise
				}
			} finally {
				this.logger.end(compileTask)
			}

			// 第五步：提取公共模块
			if (!pathOnly) {
				const bundleTask = this.logger.begin(i18n`Bundling modules...`)
				try {
					for (const bundler of this.bundlers.values()) {
						if (bundler && bundler.bundle) {
							await bundler.bundle(entryModules, this)
						}
					}
					result.doneTaskCount++
					this.logger.progress(result.progress)
				} finally {
					this.logger.end(bundleTask)
				}
			}

			// 第六步：生成、优化、保存模块
			const emitTask = this.logger.begin(i18n`Emitting modules...`)
			try {
				const promises: Promise<void>[] = []
				for (const module of entryModules) {
					await this._emitModule(module)
					if (this.noEmit || pathOnly) {
						result.doneTaskCount++
						this.logger.progress(result.progress)
						continue
					}
					promises.push(this._writeModule(module).then(() => {
						result.doneTaskCount++
						this.logger.progress(result.progress)
					}))
				}
				await Promise.all(promises)
			} finally {
				this.logger.end(emitTask)
			}

			// 第七步：完成构建
			this.emit("buildEnd", result)
			this.off("buildError", recordError)
			this.off("buildWarning", recordWarning)
		} finally {
			this.logger.end(buildTask)
			this.logger.reset()
		}
		if (this.reporter) {
			this.reporter(result, this)
		}
		return result

		function recordError() { result.errorCount++ }
		function recordWarning() { result.warningCount++ }
	}

	// #endregion

	// #region 增量构建

	/** 生成操作的确认对象，确保同时仅一个模块在生成 */
	private _emitPromise?: Promise<void>

	/** 当一个模块正在生成时缓存其它待生成的模块列表 */
	private readonly _pendingModules: Module[] = []

	/**
	 * 获取最终生成的模块
	 * @param outPath 模块的最终保存绝对路径
	 * @returns 返回一个模块，模块的状态表示其是否已生成成功，如果模块不存在则返回 `undefined`
	 */
	async getEmittedModule(outPath: string) {
		// 模块不存在或已生成
		const module = this.emittedModules.get(outPath)
		if (!module || module.state === ModuleState.emitted) {
			return module
		}
		// 载入模块
		if (module.state === ModuleState.initial) {
			this._loadModule(module)
		}
		// 确认所有模块都已加载
		if (this._loadPromise) {
			await this._loadPromise
		}
		// 假设一个 HTML 引用了 2 个图片，刚加载完第 1 个时，2 个图片都被更新
		// 此时如果重新生成 2 个图片，可能导致这个 HTML 引了不同版本的图片
		// 为避免这个情况，一旦进入生成阶段，所有文件都将禁止更新
		// 将模块添加到生成队列
		if (module.state === ModuleState.loaded) {
			this._pendingModules.push(module)
		}
		// 确认所有模块都已生成
		if (this._emitPromise) {
			await this._emitPromise
		} else {
			let emitCallback!: () => void
			this._emitPromise = new Promise(resolve => {
				emitCallback = resolve
			})
			try {
				while (this._pendingModules.length > 0) {
					await this._emitModule(this._pendingModules.shift()!)
				}
			} finally {
				this._emitPromise = undefined
				emitCallback()
			}
		}
		return module
	}

	/**
	 * 记录某个模块被更改
	 * @param path 被更改的模块绝对路径
	 */
	commitChange(path: string) {
		const module = this.modules.get(path)
		if (module) {
			if (module.state !== ModuleState.changed) {
				this._updateModule(module, ModuleState.changed, true)
			}
		} else {
			this._updateReference(path)
		}
	}

	/**
	 * 记录某个模块已删除
	 * @param path 被删除的模块绝对路径
	 */
	commitDelete(path: string) {
		const module = this.modules.get(path)
		if (module) {
			if (module.state !== ModuleState.deleted) {
				this._updateModule(module, ModuleState.deleted, true)
			}
		} else {
			this._updateReference(path)
		}
	}

	/**
	 * 更新模块状态
	 * @param module 被更改的模块
	 * @param state 新的模块状态
	 * @param fileChanged 如果是用户直接改动则为 `true`，如果是因为引用关系间接改动则为 `false`
	 */
	private async _updateModule(module: Module, state: ModuleState, fileChanged: boolean) {
		// 正在生成阶段，等待生成结束
		if (this._emitPromise) {
			await this._emitPromise
		}
		// 如果模块已生成，删除已生成模块
		if (module.state === ModuleState.emitted && !module.noEmit) {
			const emittedModule = this.emittedModules.get(module.path)
			if (emittedModule === module) {
				this.emittedModules.delete(module.path)
			}
		}
		if (this._loadPromise) {
			// 正在加载模块阶段，重新加载对应的模块
			const oldState = module.state
			module.state = state
			// 如果模块正在加载，为避免影响处理器插件，延迟到插件执行完成后处理（在 _loadModule 负责处理）
			if (oldState !== ModuleState.loading) {
				module.reset()
				if (state === ModuleState.changed) {
					this._loadModule(module)
				}
			}
		} else {
			// 空闲阶段，直接更新状态
			module.state = state
			module.reset()
		}
		this.emit("updateModule", module, fileChanged)
		this._updateReference(module.originalPath)
	}

	/**
	 * 更新引用指定模块的所有模块
	 * @param path 被更改的路径
	 */
	private _updateReference(path: string) {
		const references = this.references.get(path)
		if (references) {
			for (const reference of references) {
				if (reference.state & ModuleState.updated) {
					continue
				}
				this._updateModule(reference, ModuleState.changed, false)
			}
		}
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

	// #region 载入模块

	/** 获取所有模块，键为模块的原始绝对路径 */
	readonly modules = new Map<string, Module>()

	/**
	 * 获取指定路径对应的模块
	 * @param path 模块的原始绝对路径
	 */
	getModule(path: string) {
		let module = this.modules.get(path)
		if (module === undefined) {
			this.modules.set(path, module = new Module(path, this.isEntryModule(path)))
		}
		return module
	}

	/**
	 * 判断指定的路径是否是入口模块
	 * @param path 要判断的原始绝对路径
	 */
	isEntryModule(path: string) {
		return containsPath(this.rootDir, path, this.fs.isCaseInsensitive) && this.matcher.test(path)
	}

	/** 正在载入的模块数 */
	private _loadCount = 0

	/** 正在载入模块的确认对象 */
	private _loadPromise?: Promise<void>

	/** 所有模块载入完成的回调函数 */
	private _loadCallback?: () => void

	/** 所有模块打包器 */
	readonly bundlers = new Map<string, Bundler | false>()

	/** 所有可用的名称解析器 */
	readonly resolvers: {
		/** 源模块路径的匹配器 */
		readonly matcher?: Matcher
		/**
		 * 在解析模块路径之前的回调函数
		 * @param moduleName 要解析的模块名
		 * @param query 附加的查询参数
		 * @param module 当前地址所在的模块
		 * @param builder 当前的构建器对象
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
		 * @param module 当前地址所在的模块
		 * @param builder 当前的构建器对象
		 * @returns 返回实际解析后的路径，如果路径不存在则返回空，如果路径不存在且忽略错误则返回 `false`
		 */
		readonly after?: (resolvedPath: string | null | false, moduleName: string, query: null | { [key: string]: string }, module: Module, builder: Builder) => string | false
	}[] = []

	/** 用于标记内联的查询参数名 */
	readonly inlineQuery?: string

	/** 用于标记不检查指定路径的查询参数名 */
	readonly noCheckQuery?: string

	/** 获取所有内置模块 */
	readonly builtinModules = new Map<string, string | false>()

	/**
	 * 加载指定的模块及其依赖
	 * @param module 要加载的模块
	 * @description 本函数仅等待当前模块加载完成，不会等待依赖
	 */
	private async _loadModule(module: Module) {
		try {
			// 理论上，加载一个模块，需要等待其依赖和依赖的依赖都加载完成
			// 但如果有循环依赖，就会导致互相等待，为简化复杂度
			// 改用全局计数器的方式，等待所有模块都加载完毕，可以避免循环依赖问题
			if (this._loadCount++ === 0) {
				this._loadPromise = new Promise(resolve => {
					this._loadCallback = resolve
				})
			}
			// 每个模块都是独立加载的，如果模块在加载期间被更新，则重新加载该模块
			while (true) {
				// 准备加载
				module.state = ModuleState.loading
				// 编译模块
				await this._processModule(this.compilerRoot, module)
				if (module.state & ModuleState.updated) {
					module.reset()
					if (module.state === ModuleState.deleted) {
						break
					}
					continue
				}
				// 解析模块
				let bundler = module.bundler
				if (bundler === undefined) module.bundler = bundler = this.bundlers.get(module.ext.toLowerCase())
				if (bundler) {
					if (!module.type) {
						module.type = bundler.type
					}
					if (module.data === undefined && bundler.read !== false) {
						const readTask = this.logger.begin({
							source: i18n`Reading`,
							fileName: module.originalPath
						})
						try {
							if (bundler.read === "text") {
								module.data = await this.fs.readFile(module.originalPath, this.encoding)
							} else {
								module.data = await this.fs.readFile(module.originalPath)
							}
						} catch (e) {
							module.addError({
								source: i18n`Bundler`,
								message: i18n`Cannot read file: ${e.message}`,
								error: e
							})
							break
						} finally {
							this.logger.end(readTask)
						}
						if (module.state & ModuleState.updated) {
							module.reset()
							if (module.state === ModuleState.deleted) {
								break
							}
							continue
						}
					}
					const parseTask = this.logger.begin({
						source: i18n`Parsing`,
						fileName: module.originalPath
					})
					try {
						await bundler.parse(module, this)
					} catch (e) {
						module.addError({
							source: i18n`Bundler`,
							error: e,
							printErrorStack: true
						})
					} finally {
						this.logger.end(parseTask)
					}
					if (module.state & ModuleState.updated) {
						module.reset()
						if (module.state === ModuleState.deleted) {
							break
						}
						continue
					}
				}
				// 加载依赖
				if (module.dependencies) {
					for (const dependency of module.dependencies) {
						// 如果插件已解析模块，则跳过
						if (dependency.module) {
							if (dependency.module.state <= ModuleState.changed) {
								this._loadModule(dependency.module)
							}
							continue
						}
						// 如果插件已解析绝对路径，则不解析名称
						if (dependency.path) {
							dependency.module = this.getModule(dependency.path)
							if (dependency.module.state <= ModuleState.changed) {
								this._loadModule(dependency.module)
							}
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
									// 解析内置模块
									let builtinModule = this.builtinModules.get(name)
									if (builtinModule !== undefined) {
										// 无可替代实现
										if (!builtinModule) {
											break
										}
										// 首次使用自动下载依赖
										if (!isAbsolutePath(builtinModule)) {
											const { createRequireFromPath } = require("module")
											const localRequire = createRequireFromPath(this.baseDir) as typeof require
											try {
												builtinModule = localRequire.resolve(builtinModule)
											} catch (e) {
												if (e.code !== "MODULE_NOT_FOUND" || !this.autoInstallModules) {
													throw e
												}
											}
											await this.installModule(name.replace(/\/.*$/, ""))
											builtinModule = localRequire.resolve(builtinModule)
											this.builtinModules.set(name, builtinModule)
										}
										dependency.module = this.getModule(builtinModule)
										if (dependency.module.state <= ModuleState.updated) {
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
											await this.installModule(name)
										}
										const resolveContext: ResolveContext = { trace: [] }
										resolvedPath = await resolver.resolver.resolve(name, containingDir, resolveContext)
										if (resolvedPath === null) {
											this.emit("moduleNotFound", name, dependency, module)
											detail = resolveContext.trace!.join("\n")
										}
									}
								} else if (isAbsoluteURL(name)) {
									resolvedPath = false
								} else {
									name = resolvePath(module.originalPath, "..", name)
									if (await this.fs.existsFile(name)) {
										resolvedPath = name
									} else {
										this.emit("moduleNotFound", name, dependency, module)
										resolvedPath = await this.fs.existsFile(name) ? name : null
									}
								}
								if (resolver.after) resolvedPath = resolver.after(resolvedPath, name, query, module, this)
								dependency.path = resolvedPath
								if (resolvedPath) {
									dependency.module = this.getModule(resolvedPath)
									if (dependency.module.state <= ModuleState.updated) {
										this._loadModule(dependency.module)
									}
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
				// 完成加载
				if (module.state & ModuleState.updated) {
					module.reset()
					if (module.state === ModuleState.deleted) {
						break
					}
					continue
				}
				if (!module.type) {
					module.type = this.getMimeType(module.ext)
				}
				module.state = ModuleState.loaded
				this.emit("loadModule", module)
				break
			}
		} catch (e) {
			module.addError(e)
		} finally {
			// 加载完成
			if (--this._loadCount === 0) {
				const resolve = this._loadCallback!
				this._loadCallback = this._loadPromise = undefined
				resolve()
			}
		}
		await this.reportErrorAndWarnings(module)
	}

	// #endregion

	// #region 处理模块

	/** 获取第一个编译器 */
	readonly compilerRoot?: ResolvedProcessorRule

	/** 获取第一个优化器 */
	readonly optimizerRoot?: ResolvedProcessorRule

	/** 获取读取文本文件内容时，默认使用的文件编码 */
	readonly encoding: string

	/** 获取多核并行处理器个数 */
	readonly parallel: number

	/**
	 * 使用指定的处理器处理模块
	 * @param processor 要使用的处理器
	 * @param module 要处理的模块
	 */
	private async _processModule(processor: ResolvedProcessorRule | undefined, module: Module) {
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
						let use = processor.use!
						if (typeof use === "string") {
							use = await this.require(use) as ProcessorFactory
						}
						// 如果有多个模块都需要使用此处理器，第一次会加载处理器并创建处理器实例，下一次只需等待
						if (!processor.processor) {
							if (use.name) {
								processor.name = use.name
							}
							processor.processor = new use(processor.options, this)
						}
					} catch (e) {
						// 避免重复报告插件加载失败的错误
						if (!processor.processor) {
							let reported = false
							processor.processor = {
								read: false,
								process(module) {
									module.addError({
										message: i18n`Skipped because cannot load plugin '${processor!.name}': ${e
											.message}`,
										error: e,
										printErrorStack: !reported
									})
									reported = true
								}
							}
						}
					}
				} else {
					processor.processor = { read: false, process() { } }
				}
			}
			// 读取模块内容
			if (module.data === undefined && processor.processor.read !== false) {
				if (module.state & ModuleState.updated) {
					break
				}
				const readTask = this.logger.begin({
					source: i18n`Reading`,
					fileName: module.originalPath
				})
				try {
					if (processor.processor.read === "text") {
						module.data = await this.fs.readFile(module.originalPath, this.encoding)
					} else {
						module.data = await this.fs.readFile(module.originalPath)
					}
				} catch (e) {
					module.addError({
						source: processor.name,
						message: i18n`Cannot read file: ${e.message}`,
						error: e
					})
					break
				} finally {
					this.logger.end(readTask)
				}
			}
			// 处理模块
			if (module.state & ModuleState.updated) {
				break
			}
			const processTask = this.logger.begin({
				source: processor.name,
				fileName: module.originalPath
			})
			try {
				await processor.processor.process(module, this)
			} catch (e) {
				module.addError({
					source: processor.name,
					error: e,
					printErrorStack: true
				})
				break
			} finally {
				this.logger.end(processTask)
			}
			if (module.hasErrors) {
				break
			}
			// 计算输出路径
			if (processor.outPath) {
				module.path = resolvePath(this.rootDir, processor.outPath(module, this))
			}
			// 根据配置终止处理
			if (module.hasErrors) {
				break
			}
			processor = processor.nextTrue
		}
	}

	// #endregion

	// #region 生成模块

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
		// 多个模块的生成操作需要串行，因为：
		// 1. 生成操作期间几乎不使用 IO，对单线程的 Node 来说，串行和并行性能差别小
		// 2. 并行需处理模块循环依赖问题，比较复杂
		// 生成兄弟模块
		if (module.siblings) {
			for (const sibling of module.siblings) {
				await this._emitModule(sibling)
			}
		}
		try {
			// 避免重复生成
			module.state = ModuleState.emitting
			// 生成模块
			const bundler = module.bundler
			if (bundler) {
				const generateTask = this.logger.begin({
					source: i18n`Generating`,
					fileName: module.originalPath
				})
				try {
					await bundler.generate(module, module, this)
				} catch (e) {
					module.addError({
						source: i18n`Bundler`,
						error: e,
						printErrorStack: true
					})
				} finally {
					this.logger.end(generateTask)
				}
			}
			// 优化模块
			if (this.optimizerRoot && !module.hasErrors) {
				await this._processModule(this.optimizerRoot, module)
			}
			// 计算路径
			if (module.isEntryModule) {
				module.path = this.getOutputPath(module.path)
			} else {
				let inline = true
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
					module.path = resolvePath(this.outDir, externalModule.outPath(module, this))
					inline = false
					break
				}
				if (inline) {
					module.noEmit = true
				}
			}
			// 检查路径
			const path = module.path
			if (!module.noEmit) {
				if (!this.noPathCheck) {
					if (module.data != undefined && pathEquals(module.originalPath, path, this.fs.isCaseInsensitive)) {
						module.noEmit = true
						module.addError(i18n`Cannot overwrite source file`)
					}
					if (!containsPath(this.outDir, path, this.fs.isCaseInsensitive)) {
						module.noEmit = true
						module.addError(i18n`Cannot write files outside the outDir '${this.logger.formatPath(this.outDir)}': '${path}'`)
					}
				}
				// 检查路径冲突
				const exists = this.emittedModules.get(path)
				if (exists && !(exists.state & ModuleState.changed)) {
					if (exists !== module) {
						module.noEmit = true
						module.addError(i18n`Output path conflicts with '${this.logger.formatPath(exists.originalPath)}': '${path}'`)
					}
				} else {
					this.emittedModules.set(path, module)
				}
			}
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
					if (mapURL) {
						if (module.data === undefined) {
							module.data = await this.fs.readFile(module.originalPath, this.encoding)
						}
						module.content += createSourceMappingURLComment(mapURL, /\.js$/i.test(path))
					}
				}
			}
			module.emitTime = Date.now()
			module.state = ModuleState.emitted
			this.emit("emitModule", module)
			if (module.references) {
				for (const reference of module.references) {
					this.addReference(module, reference)
				}
			}
		} catch (e) {
			module.addError(e)
		}
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

	// #region 保存模块

	/**
	 * 保存指定的模块
	 * @param module 要保存的模块
	 */
	private async _writeModule(module: Module) {
		if (module.siblings) {
			for (const sibling of module.siblings) {
				await this._writeModule(sibling)
			}
		}
		// 允许插件跳过保存当前模块
		if (module.noEmit || module.state & ModuleState.changed) {
			return
		}
		// 保存源映射
		if (module.sourceMap && this.sourceMap && !this.sourceMapOptions.inline) {
			const writeTask = this.logger.begin({
				source: i18n`Writing`,
				fileName: module.sourceMapPath
			})
			try {
				await this.fs.writeFile(module.sourceMapPath!, JSON.stringify(module.sourceMapObject, undefined, this.sourceMapOptions.indent))
			} catch (e) {
				module.addError({
					fileName: module.sourceMapPath,
					message: `Cannot write file: ${e.message}`,
					error: e
				})
			} finally {
				this.logger.end(writeTask)
			}
		}
		// 保存文件
		if (module.data !== undefined) {
			const writeTask = this.logger.begin({
				source: i18n`Writing`,
				fileName: module.originalPath
			})
			try {
				await this.fs.writeFile(module.path, module.data)
			} catch (e) {
				module.addError({
					message: `Cannot write file: ${e.message}`,
					error: e
				})
			} finally {
				this.logger.end(writeTask)
			}
		} else if (!pathEquals(module.originalPath, module.path, this.fs.isCaseInsensitive)) {
			const copyTask = this.logger.begin({
				source: i18n`Copying`,
				fileName: module.originalPath
			})
			try {
				await this.fs.copyFile(module.originalPath, module.path)
			} catch (e) {
				module.addError({
					message: `Cannot copy file: ${e.message}`,
					error: e
				})
			} finally {
				this.logger.end(copyTask)
			}
		}
		this.emit("writeModule", module)
		await this.reportErrorAndWarnings(module)
	}

	// #endregion

	// #region 错误和警告

	/** 判断是否在出现第一个错误后终止构建 */
	readonly bail: boolean

	/**
	 * 报告指定模块新产生的错误和警告
	 * @param module 要处理的模块
	 */
	protected async reportErrorAndWarnings(module: Module) {
		if (module.errors) {
			for (let i = module.reportedErrorCount; i < module.errors.length; i++) {
				const logEntry = module.errors[i]
				if (logEntry.line != undefined && logEntry.content == undefined && logEntry.fileName != undefined && this.logger.codeFrame && logEntry.codeFrame == undefined) {
					logEntry.content = await this.fs.readFile(logEntry.fileName, this.encoding)
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
					logEntry.content = await this.fs.readFile(logEntry.fileName, this.encoding)
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

	/** 获取用于安装模块的命令，其中 `<module>` 会被替换为实际的模块名 */
	readonly installCommand: string

	/** 正在安装的模块列表 */
	private readonly _installingModules = new Map<string, Promise<ExecResult>>()

	/**
	 * 安装一个模块
	 * @param module 要安装的模块
	 * @returns 如果安装成功则返回 `true`，否则说明模块路径错误或安装命令退出状态码非 0，返回 `false`
	 */
	async installModule(module: string) {
		// 检测模块名
		if (/^[./~]/.test(module) || isAbsolutePath(module)) {
			return false
		}
		if (module.indexOf("/") >= 0) {
			// 当用户请求 foo/goo 时，foo 更可能是本地的全局模块，而非来自 NPM
			if (!module.startsWith("@")) {
				return false
			}
			// @foo/goo 更像是 NPM 上的包
			module = module.split("/", 2).join("/")
		}
		// 如果模块正在安装，则等待
		const exists = this._installingModules.get(module)
		if (exists) {
			return (await exists).exitCode === 0
		}
		const command = this.installCommand.replace("<module>", module)
		const installTask = this.logger.begin(i18n`Installing module '${module}'...`)
		if (this.logger.logLevel === LogLevel.verbose) {
			this.logger.verbose(`${this.baseDir}>${command}`)
		}
		const promise = exec(command, {
			cwd: this.baseDir,
			env: {
				...process.env,
				// 避免出现权限问题
				NODE_ENV: null!
			}
		})
		this._installingModules.set(module, promise)
		const result = await promise
		if (result.stderr) {
			this.logger.log(result.stderr)
		}
		if (result.stdout) {
			this.logger.log(result.stdout)
		}
		this._installingModules.delete(module)
		this.logger.end(installTask)
		return result.exitCode === 0
	}

	/**
	 * 载入一个本地模块
	 * @param module 要载入的模块
	 * @param autoInstallModules 是否自动安装模块
	 */
	async require(module: string, autoInstallModules = this.autoInstallModules): Promise<any> {
		// 从当前程序安装路径查找模块
		const { createRequireFromPath } = require("module")
		const localRequire = createRequireFromPath(this.baseDir) as typeof require
		try {
			return localRequire(module)
		} catch (e) {
			if (e.code !== "MODULE_NOT_FOUND") {
				throw e
			}
			// 从全局路径查找模块
			try {
				return require(module)
			} catch (e2) {
				if (e2.code !== "MODULE_NOT_FOUND") {
					throw e2
				}
			}
			if (!autoInstallModules) {
				throw e
			}
		}
		// 安装完成后重新加载模块
		await this.installModule(module)
		return await this.require(module, false)
	}

	// #endregion

	// #region 打包辅助

	/** 指定如何合并依赖生成最终的代码 */
	output: {
		/**
		 * 最终引用模块的根地址，一般以 `/` 结尾
		 * @description 如果需要使用 CDN，可配置成 CDN 的根地址，同时记得在发布后将相关文件上传到 CDN 服务器
		 * @default "/"
		 * @example "https://cdn.example.com/assets/"
		 */
		publicURL?: string
		/**
		 * 最终是否以相对路径引用模块
		 * - `"auto"`（默认）:默认使用相对路径，如果模块可能被内联到其它模块，则改用绝对路径
		 * - `true`：强制使用相对路径
		 * - `false`：强制使用绝对路径
		 */
		relativeURL?: "auto" | boolean
		/**
		 * 自定义最终在生成模块中引用其它模块的地址的回调函数
		 * @param module 要引用的模块
		 * @param containingModule 地址所在的模块
		 * @param builder 当前的构建器对象
		 * @return 返回生成的地址
		 * @example (module, containingModule) => relativePath(containingModule.dir, module.path) // 改用相对地址
		*/
		formatURL?: (module: Module, containingModule: Module, builder: Builder) => string | undefined
		/**
		 * 在最终合并生成的模块开头追加的内容
		 * @param containingModule 要生成的模块
		 * @param builder 当前的构建器对象
		 * @example "/* This file is generated by tpack. DO NOT EDIT DIRECTLY!! *‌/"
		 */
		prepend?: (containingModule: Module, builder: Builder) => string
		/**
		 * 在最终合并生成的模块末尾追加的内容
		 * @param containingModule 要生成的模块
		 * @param builder 当前的构建器对象
		 */
		append?: (containingModule: Module, builder: Builder) => string
		/**
		 * 在每个依赖模块开头追加的内容
		 * @param module 引用的模块
		 * @param containingModule 要生成的模块
		 * @param builder 当前的构建器对象
		 */
		modulePrepend?: (module: Module, containingModule: Module, builder: Builder) => string
		/**
		 * 在每个依赖模块末尾追加的内容
		 * @param module 引用的模块
		 * @param containingModule 要生成的模块
		 * @param builder 当前的构建器对象
		 */
		moduleAppend?: (module: Module, containingModule: Module, builder: Builder) => string
		/**
		 * 在每个依赖模块之间插入的代码
		 * @default "\n\n"
		 */
		moduleSeperator?: string
		/**
		 * 生成的文件中用于缩进源码的字符串
		 * @default "\t"
		 */
		indentString?: string
		/**
		 * 生成的文件中用于换行的字符串
		 * @default "\n"
		 */
		newLine?: string
	}

	// todo

	/** 获取所有 MIME 类型 */
	readonly mimeTypes = new Map<string, string>()

	/** 获取指定扩展名对应的 MIME 类型 */
	getMimeType(ext: string) {
		return this.mimeTypes.get(ext) || "application/octet-stream"
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
	 * @default ["**‌/node_modules/**‌", "package.json"]
	 */
	exclude?: Pattern

	// #endregion

	// #region 打包

	/** 指定应该如何编译不同类型的模块 */
	compilers?: ProcessorRule[]
	/** 指定应该如何打包模块依赖 */
	bundler?: {
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
		output?: {
			/**
			 * 最终引用模块的根地址，一般以 `/` 结尾
			 * @description 如果需要使用 CDN，可配置成 CDN 的根地址，同时记得在发布后将相关文件上传到 CDN 服务器
			 * @default "/"
			 * @example "https://cdn.example.com/assets/"
			 */
			publicURL?: string
			/**
			 * 最终是否以相对路径引用模块
			 * - `"auto"`（默认）: 默认使用相对地址，如果模块可能被内联到其它模块则使用绝对地址
			 * - `true`: 强制使用相对地址
			 * - `false`: 强制使用绝对地址
			 */
			relativeURL?: "auto" | boolean
			/**
			 * 自定义最终生成的模块引用其它模块的地址的回调函数
			 * @param module 要引用的模块
			 * @param containingModule 地址所在的模块
			 * @param builder 当前的构建器对象
			 * @return 返回生成的地址
			 * @example (module, containingModule) => relativePath(containingModule.dir, module.path)
			*/
			formatURL?: (module: Module, containingModule: Module, builder: Builder) => string | undefined
			/**
			 * 在最终合并生成的模块开头追加的内容，如果是字符串，则其中以下标记会被替换：
			 * - `<path>`: 要生成的模块的相对路径，等价于 `<dir>/<name><ext>`
			 * - `<dir>`: 要生成的模块所在文件夹的相对路径
			 * - `<name>`: 要生成的模块的文件名（不含文件夹和扩展名部分）
			 * - `<ext>`: 要生成的模块的扩展名（含点）
			 * - `<md5>`: 要生成的模块内容的 MD5 串（小写），默认截取前 6 位，如果要截取前 n 位，使用 `<md5:n>`
			 * - `<sha1>`: 要生成的模块内容的 SHA-1 串（小写），默认截取前 6 位，如果要截取前 n 位，使用 `<sha1:n>`
			 * - `<date>`: 当前时间，默认为用户本地可读格式，如果要自定义格式，使用如 `<date:yyyyMMdd>`
			 * - `<random>`: 随机整数，默认为 6 位，如果要自定义为 n  位，使用如 `<rand:n>`
			 * - `<builder>`: 构建器的名字，默认为 `TPack`
			 * - `<version>`: 构建器的版本号
			 * @param containingModule 要生成的模块
			 * @param builder 当前的构建器对象
			 * @example "/* This file is generated by <builder>. DO NOT EDIT DIRECTLY!! *‌/"
			 */
			prepend?: string | ((containingModule: Module, builder: Builder) => string)
			/**
			 * 在最终合并生成的模块末尾追加的内容，如果是字符串，则其中以下标记会被替换：
			 * - `<path>`: 要生成的模块的相对路径，等价于 `<dir>/<name><ext>`
			 * - `<dir>`: 要生成的模块所在文件夹的相对路径
			 * - `<name>`: 要生成的模块的文件名（不含文件夹和扩展名部分）
			 * - `<ext>`: 要生成的模块的扩展名（含点）
			 * - `<md5>`: 要生成的模块内容的 MD5 串（小写），默认截取前 6 位，如果要截取前 n 位，使用 `<md5:n>`
			 * - `<sha1>`: 要生成的模块内容的 SHA-1 串（小写），默认截取前 6 位，如果要截取前 n 位，使用 `<sha1:n>`
			 * - `<date>`: 当前时间，默认为用户本地可读格式，如果要自定义格式，使用如 `<date:yyyyMMdd>`
			 * - `<random>`: 随机整数，默认为 6 位，如果要自定义为 n  位，使用如 `<rand:n>`
			 * - `<builder>`: 构建器的名字，默认为 `TPack`
			 * - `<version>`: 构建器的版本号
			 * @param containingModule 要生成的模块
			 * @param builder 当前的构建器对象
			 */
			append?: string | ((containingModule: Module, builder: Builder) => string)
			/**
			 * 在每个依赖模块开头追加的内容，如果是字符串，则其中以下标记会被替换：
			 * - `<path>`: 引用的模块的相对路径，等价于 `<dir>/<name><ext>`
			 * - `<dir>`: 引用的模块所在文件夹的相对路径
			 * - `<name>`: 引用的模块的文件名（不含文件夹和扩展名部分）
			 * - `<ext>`: 引用的模块的扩展名（含点）
			 * - `<md5>`: 引用的模块内容的 MD5 串（小写），默认截取前 6 位，如果要截取前 n 位，使用 `<md5:n>`
			 * - `<sha1>`: 引用的模块内容的 SHA-1 串（小写），默认截取前 6 位，如果要截取前 n 位，使用 `<sha1:n>`
			 * - `<date>`: 当前时间，默认为用户本地可读格式，如果要自定义格式，使用如 `<date:yyyyMMdd>`
			 * - `<random>`: 随机整数，默认为 6 位，如果要自定义为 n  位，使用如 `<rand:n>`
			 * - `<builder>`: 构建器的名字，默认为 `TPack`
			 * - `<version>`: 构建器的版本号
			 * @param module 引用的模块
			 * @param containingModule 要生成的模块
			 * @param builder 当前的构建器对象
			 */
			modulePrepend?: string | ((module: Module, containingModule: Module, builder: Builder) => string)
			/**
			 * 在每个依赖模块末尾追加的内容，如果是字符串，则其中以下标记会被替换：
			 * - `<path>`: 引用的模块的相对路径，等价于 `<dir>/<name><ext>`
			 * - `<dir>`: 引用的模块所在文件夹的相对路径
			 * - `<name>`: 引用的模块的文件名（不含文件夹和扩展名部分）
			 * - `<ext>`: 引用的模块的扩展名（含点）
			 * - `<md5>`: 引用的模块内容的 MD5 串（小写），默认截取前 6 位，如果要截取前 n 位，使用 `<md5:n>`
			 * - `<sha1>`: 引用的模块内容的 SHA-1 串（小写），默认截取前 6 位，如果要截取前 n 位，使用 `<sha1:n>`
			 * - `<date>`: 当前时间，默认为用户本地可读格式，如果要自定义格式，使用如 `<date:yyyyMMdd>`
			 * - `<random>`: 随机整数，默认为 6 位，如果要自定义为 n  位，使用如 `<rand:n>`
			 * - `<builder>`: 构建器的名字，默认为 `TPack`
			 * - `<version>`: 构建器的版本号
			 * @param module 引用的模块
			 * @param containingModule 要生成的模块
			 * @param builder 当前的构建器对象
			 */
			moduleAppend?: string | ((module: Module, containingModule: Module, builder: Builder) => string)
			/**
			 * 在每个依赖模块之间插入的代码
			 * @default "\n\n"
			 */
			moduleSeperator?: string
			/**
			 * 生成的文件中用于缩进源码的字符串
			 * @default "\t"
			 */
			indentString?: string
			/**
			 * 生成的文件中用于换行的字符串
			 * @default "\n"
			 */
			newLine?: string
		}

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
		 * - `<md5>`: 源模块内容的 MD5 串（小写），默认截取前 6 位，如果要截取前 n 位，使用 `<md5:n>`
		 * - `<sha1>`: 源模块内容的 SHA-1 串（小写），默认截取前 6 位，如果要截取前 n 位，使用 `<sha1:n>`
		 * - `<date>`: 当前时间，默认为用户本地可读格式，如果要自定义格式，使用如 `<date:yyyyMMdd>`
		 * - `<random>`: 随机整数，默认为 6 位，如果要自定义为 n  位，使用如 `<rand:n>`
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
		interval?: number
	}
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
	noEmit?: boolean
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
	 * - `<md5>`: 模块内容的 MD5 串（小写），默认截取前 6 位，如果要截取前 n 位，使用 `<md5:n>`
	 * - `<sha1>`: 模块内容的 SHA-1 串（小写），默认截取前 6 位，如果要截取前 n 位，使用 `<sha1:n>`
	 * - `<date>`: 当前时间，默认为用户本地可读格式，如果要自定义格式，使用如 `<date:yyyyMMdd>`
	 * - `<random>`: 随机整数，默认为 6 位，如果要自定义为 n  位，使用如 `<rand:n>`
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
	 * @param moduleName 要解析的模块名
	 * @param query 附加的查询参数
	 * @param file 当前地址所在的模块
	 * @param context 构建的上下文对象
	 * @param builder 当前的构建器对象
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
	 * @param builder 当前的构建器对象
	 * @returns 返回实际解析后的路径，如果路径不存在则返回空，如果路径不存在且忽略错误则返回 `false`
	 */
	after?: (resolvedPath: string | null | false, moduleName: string, query: null | { [key: string]: string }, module: Module, builder: Builder) => string | false
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
	 * - `<md5>`: 模块内容的 MD5 串（小写），默认截取前 6 位，如果要截取前 n 位，使用 `<md5:n>`
	 * - `<sha1>`: 模块内容的 SHA-1 串（小写），默认截取前 6 位，如果要截取前 n 位，使用 `<sha1:n>`
	 * - `<date>`: 当前时间，默认为用户本地可读格式，如果要自定义格式，使用如 `<date:yyyyMMdd>`
	 * - `<random>`: 随机整数，默认为 6 位，如果要自定义为 n  位，使用如 `<rand:n>`
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
	bundle?(modules: Module[], builder: Builder): void | Promise<void>
	/**
	 * 生成指定的模块
	 * @param module 要解析的模块
	 * @param containingModule 最终包含的模块
	 * @param builder 当前构建器实例
	 */
	generate(module: Module, containingModule: Module, builder: Builder): void | Promise<void>
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