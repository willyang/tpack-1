import { Stats } from "fs"
import { basename, dirname, isAbsolute, join, normalize, resolve, sep } from "path"
import { FileSystem } from "../utils/fileSystem"
import { escapeRegExp } from "../utils/misc"
import { relativePath } from "../utils/path"
import { i18n } from "./i18n"

/** 表示一个模块路径解析器 */
export class Resolver {

	// #region 选项

	/**
	 * 初始化新的路径解析器
	 * @param options 附加选项
	 * @param fs 使用的文件系统
	 */
	constructor(options: ResolverOptions = {}, fs = new FileSystem()) {
		this.fs = fs
		this.alias = []
		for (const key in options.alias) {
			const value = options.alias[key]
			let match: RegExp
			if (key.indexOf("*") >= 0) {
				match = new RegExp(`^${escapeRegExp(key).replace(/\\\*/g, "(.*)").replace(/\\\?/g, "(.)")}$`)
			} else if (key.endsWith("$")) {
				match = new RegExp(`^${escapeRegExp(key.slice(0, -1))}$`)
			} else {
				match = new RegExp(`^${escapeRegExp(key)}(?=/|$)`)
			}
			this.alias.push({
				match: match,
				replacements: Array.isArray(value) ? value : [value]
			})
		}
		this.aliasFields = options.aliasFields !== undefined ? options.aliasFields.length === 0 ? undefined : options.aliasFields : ["browser"]
		this.descriptionFiles = options.descriptionFiles || ["package.json"]
		this.ignoreCase = options.enforceCaseSensitive === false ? fs.isCaseInsensitive : false
		this.extensions = options.extensions || ["", ".wasm", ".tsx", ".ts", ".jsx", ".mjs", ".js", ".json"]
		if (this.extensions.indexOf("") < 0 && !options.enforceExtension) {
			this.extensions = ["", ...this.extensions]
		}
		this.mainFields = options.mainFields || ["module", "jsnext:main", "browser", "main"]
		this.mainFiles = options.mainFiles || ["index"]
		this.modules = options.modules ? options.modules.map(module => {
			if (/[\\\/]/.test(module)) {
				return {
					absolute: true,
					name: resolve(module)
				}
			} else {
				return {
					absolute: false,
					name: module
				}
			}
		}) : [{ absolute: false, name: "node_modules" }]

		// 禁用缓存
		if (options.cache === false) {
			this.resolve = this.resolveModule
			this.readDescriptionFile = this._readDescriptionFile
			this.readDir = async path => {
				try {
					const entries = await this.fs.readDir(path)
					let data: Set<string>
					if (this.ignoreCase) {
						data = new Set<string>()
						for (const entry of entries) {
							data.add(entry.toLowerCase())
						}
					} else {
						data = new Set<string>(entries)
					}
					return data
				} catch (e) {
					if (e.code === "ENOENT") {
						return null
					}
					throw e
				}
			}
			this.checkFile = async path => {
				try {
					return (await this.fs.getStat(path)).isFile()
				} catch (e) {
					if (e.code === "ENOENT") {
						return null
					}
					throw e
				}
			}
		}
	}

	// #endregion

	// #region 解析

	/** 解析结果的缓存，键为要解析的名称 */
	private readonly _resolveCache = new Map<string, string | null | false | Promise<string | null | false>>()

	/**
	 * 解析指定的模块名对应的绝对路径
	 * @param moduleName 要解析的模块名
	 * @param containingDir 当前引用所在文件夹的绝对路径
	 * @param context 解析的上下文对象，用于接收解析详情
	 * @returns 如果找不到模块则返回空，如果该模块配置为不引用则返回 `false`
	 */
	async resolve(moduleName: string, containingDir: string, context?: ResolveContext) {
		const key = `${moduleName}|${containingDir}`
		const cache = this._resolveCache.get(key)
		if (cache) {
			if (context) context.cache = true
			if (cache instanceof Promise) {
				return await cache
			}
			return cache
		}
		const promise = this.resolveModule(moduleName, containingDir, context)
		this._resolveCache.set(key, promise)
		const result = await promise
		this._resolveCache.set(key, result)
		return result
	}

	/** 获取解析的路径映射 */
	readonly alias?: ({
		/** 匹配的正则表达式 */
		match: RegExp,
		/** 匹配后用于替换的内容，如果是 `false` 表示忽略该模块 */
		replacements: (string | ((input: string, ...parts: string[]) => string) | false)[]
	})[]

	/** 获取描述文件中包含 `alias` 信息的字段名 */
	readonly aliasFields?: string[]

	/** 获取要搜索的模块文件夹路径 */
	readonly modules: {
		/** 当前模块路径是否是绝对路径 */
		absolute: boolean
		/** 当前模块名 */
		name: string
	}[]

	/**
	 * 底层解析指定的模块名对应的绝对路径
	 * @param moduleName 要解析的模块名
	 * @param containingDir 当前引用所在的文件夹的绝对路径
	 * @param context 解析的上下文对象，用于接收解析详情
	 * @param ignorePathMapping 是否忽略路径映射
	 * @returns 如果找不到模块则返回空，如果该模块配置为不引用则返回 `false`
	 */
	protected async resolveModule(moduleName: string, containingDir: string, context?: ResolveContext, ignorePathMapping?: boolean): Promise<string | null | false> {
		if (moduleName.startsWith(".")) {
			// 解析相对路径
			if (moduleName.startsWith("./") || moduleName.startsWith("../")) {
				moduleName = join(containingDir, moduleName)
				return await this.resolveFileOrDir(moduleName, context, !moduleName.endsWith(sep), true)
			}
			// . 表示所在文件夹本身
			if (moduleName === ".") {
				return await this.resolveFileOrDir(containingDir, context, false, true)
			}
			// .. 表示父文件夹本身
			if (moduleName === "..") {
				return await this.resolveFileOrDir(dirname(containingDir), context, false, true)
			}
		}
		// 解析绝对路径
		if (isAbsolute(moduleName)) {
			moduleName = normalize(moduleName)
			return await this.resolveFileOrDir(moduleName, context, !moduleName.endsWith(sep), true)
		}
		// 应用映射
		if (this.alias && !ignorePathMapping) {
			let hasMatch = false
			for (const alias of this.alias) {
				if (!alias.match.test(moduleName)) {
					continue
				}
				hasMatch = true
				for (const replacement of alias.replacements) {
					// 通过别名忽略某些模块
					if (replacement === false) {
						return false
					}
					const mapped = moduleName.replace(alias.match, replacement as any)
					if (context && context.trace) context.trace.push(i18n`Apply path mapping: '${alias.match}' -> '${mapped}'`)
					const result = await this.resolveModule(mapped, containingDir, context, true)
					if (result != null) {
						return result
					}
				}
			}
			if (hasMatch) {
				return null
			}
		}
		// 引用包模块映射
		// https://github.com/defunctzombie/package-browser-field-spec
		if (this.aliasFields) {
			const descriptionFile = await this.lookupDescriptionFile(containingDir, context)
			if (descriptionFile) {
				const aliasField = this.getFieldInDescriptionFile(descriptionFile, this.aliasFields)
				if (aliasField) {
					const aliasValue = descriptionFile[aliasField]
					if (typeof aliasValue === "object") {
						const aliasName = aliasValue[moduleName]
						if (aliasName === false) {
							if (context && context.trace) context.trace.push(i18n`Read field '${aliasField}' from '${descriptionFile.__path__}' -> false`)
							return false
						}
						if (typeof aliasName === "string") {
							if (context && context.trace) context.trace.push(i18n`Read field '${aliasField}' from '${descriptionFile.__path__}' -> '${aliasName}'`)
							return await this.resolveModule(aliasName, dirname(descriptionFile.__path__), context)
						}
					} else {
						if (context && context.trace) context.trace.push(i18n`Read field '${aliasField}' from '${descriptionFile.__path__}' -> Invalid(Not an object)`)
					}
				} else {
					if (context && context.trace) context.trace.push(i18n`Read field '${this.aliasFields.join("/")}' from '${descriptionFile.__path__}' -> Not found`)
				}
			}
		}
		// 遍历 node_modules
		for (const moduleDirectory of this.modules) {
			if (moduleDirectory.absolute) {
				const fullPath = join(moduleDirectory.name, moduleName)
				const result = await this.resolveFileOrDir(fullPath, context, !fullPath.endsWith(sep), true)
				if (result != null) {
					return result
				}
			} else {
				let current = containingDir
				while (true) {
					// 跳过 node_modules 本身
					if (basename(current) !== moduleDirectory.name) {
						const fullPath = join(current, moduleDirectory.name, moduleName)
						const result = await this.resolveFileOrDir(fullPath, context, !fullPath.endsWith(sep), true)
						if (result != null) {
							return result
						}
					}
					const parent = dirname(current)
					if (parent.length === current.length) {
						break
					}
					current = parent
				}
			}
		}
		return null
	}

	/** 获取解析模块名时尝试自动追加的扩展名 */
	readonly extensions: string[]

	/** 获取描述文件中包含入口模块的字段名 */
	readonly mainFields: string[]

	/** 获取解析文件夹时默认使用的文件名 */
	readonly mainFiles: string[]

	/** 获取所有描述文件名 */
	readonly descriptionFiles: string[]

	/**
	 * 解析一个文件或文件夹路径
	 * @param path 要解析的绝对路径
	 * @param context 解析的上下文对象，用于接收解析详情
	 * @param testFile 是否测试路径是否是文件路径
	 * @param testDir 是否测试路径是文件夹路径
	 * @param enforceExtension 是否需要强制使用扩展名
	 * @param ignoreDescriptionFile 是否忽略包描述文件
	 */
	protected async resolveFileOrDir(path: string, context?: ResolveContext, testFile?: boolean, testDir?: boolean, enforceExtension?: boolean, ignoreDescriptionFile?: boolean): Promise<string | null | false> {
		// 读取所在文件夹
		const parent = dirname(path)
		let entries: Set<string> | false | null
		try {
			entries = await this.readDir(parent)
			// 文件夹不存在(false)或是一个文件(null)
			if (!entries) {
				if (context && context.trace) context.trace.push(entries === null ? i18n`Test '${parent}' -> Not found` : i18n`Test '${parent}' -> Skipped, not a directory`)
				return null
			}
		} catch (e) {
			if (context && context.trace) context.trace.push(i18n`Test '${parent}' -> ${e.message}`)
			return null
		}
		const name = basename(path)

		// 尝试追加文件扩展名
		if (testFile) {
			for (const extension of this.extensions) {
				if (!extension && enforceExtension) {
					continue
				}
				// 通过文件列表快速测试文件是否存在
				if (!entries.has(this.ignoreCase ? (name + extension).toLowerCase() : name + extension)) {
					if (context && context.trace) context.trace.push(i18n`Test '${path}${extension}' -> Not found`)
					continue
				}
				const fullPath = path + extension
				try {
					const isFile = await this.checkFile(fullPath)
					if (isFile) {
						// 应用所在包的别名
						if (this.aliasFields) {
							const descriptionFile = await this.lookupDescriptionFile(parent, context)
							if (descriptionFile) {
								const aliasField = this.getFieldInDescriptionFile(descriptionFile, this.aliasFields)
								if (aliasField) {
									const aliasValue = descriptionFile[aliasField]
									if (typeof aliasValue === "object") {
										const name = "./" + relativePath(dirname(descriptionFile.__path__), fullPath)
										const aliasName = aliasValue[name]
										if (aliasName === false) {
											if (context && context.trace) context.trace.push(i18n`Read field '${aliasField}' from '${descriptionFile.__path__}' -> false`)
											return false
										}
										if (typeof aliasName === "string") {
											if (context && context.trace) context.trace.push(i18n`Read field '${aliasField}' from '${descriptionFile.__path__}' -> '${aliasName}'`)
											return await this.resolveModule(aliasName, dirname(descriptionFile.__path__), context)
										}
									} else {
										if (context && context.trace) context.trace.push(i18n`Read field '${aliasField}' from '${descriptionFile.__path__}' -> Invalid(Not an object)`)
									}
								} else {
									if (context && context.trace) context.trace.push(i18n`Read field '${this.aliasFields.join("/")}' from '${descriptionFile.__path__}' -> Not found`)
								}
							}
						}
						if (context && context.trace && (extension || ignoreDescriptionFile)) context.trace.push(i18n`Test '${fullPath}' -> Succeed`)
						return fullPath
					} else {
						if (context && context.trace && (extension || ignoreDescriptionFile)) context.trace.push(isFile === null ? i18n`Test '${fullPath}' -> Not found` : i18n`Test '${fullPath}' -> Skipped, not a file`)
					}
				} catch (e) {
					if (context && context.trace) context.trace.push(i18n`Test '${fullPath}' -> ${e.message}`)
				}
			}
			// 搜索是否因为用户忽略了大小写导致搜索失败
			if (context && context.trace) {
				for (const extension of this.extensions) {
					const fullPath = path + extension
					try {
						if (await this.checkFile(fullPath)) {
							context.trace.push(i18n`Do you mean '${fullPath}'(Case sensitive)?`)
							break
						}
					} catch { }
				}
			}
		}

		// 搜索同名文件夹
		if (testDir) {
			if (entries.has(this.ignoreCase ? name.toLowerCase() : name)) {
				// 尝试依据 main 字段
				if (!ignoreDescriptionFile) {
					const descriptionFile = await this.readDescriptionFile(path, context)
					if (descriptionFile) {
						const mainField = this.getFieldInDescriptionFile(descriptionFile, this.mainFields)
						if (mainField != undefined) {
							const mainValue = descriptionFile[mainField]
							if (typeof mainValue === "string") {
								const mainFullPath = join(path, mainValue)
								if (context && context.trace) context.trace.push(i18n`Read field '${mainField}' from '${descriptionFile.__path__}' -> '${mainFullPath}'`)
								const result = await this.resolveFileOrDir(mainFullPath, context, !mainFullPath.endsWith(sep), true, false, true)
								if (result) {
									return result
								}
							} else {
								if (context && context.trace) context.trace.push(i18n`Read field '${mainField}' from '${descriptionFile.__path__}' -> Invalid(not a string)`)
							}
						} else {
							if (context && context.trace) context.trace.push(i18n`Read field '${this.mainFields.join("/")}' from '${descriptionFile.__path__}' -> Not found`)
						}
					}
				}
				// 尝试首页
				for (const mainFileName of this.mainFiles) {
					const mainFilePath = join(path, mainFileName === "&" ? basename(path) : mainFileName)
					const result = await this.resolveFileOrDir(mainFilePath, context, true, false, true)
					if (result) {
						return result
					}
				}
				if (context && context.trace) context.trace.push(i18n`Skipped '${path}' because no entry file('${this.descriptionFiles.join("/")}/${this.mainFiles.join("/")}') found`)
			} else if (context && context.trace) {
				context.trace.push(i18n`Test '${path}' -> Not found`)
				try {
					if (await this.readDir(path)) {
						context.trace.push(i18n`Do you mean '${path}'(Case sensitive)?`)
					}
				} catch { }
			}
		}

		return null
	}

	/** 描述文件数据的缓存 */
	private readonly _descriptionFileCache = new Map<string, any | Promise<any>>()

	/**
	 * 读取属于某个文件夹的描述文件（如 `package.json`）
	 * @param dir 要查找的文件夹
	 * @param context 解析的上下文对象，用于接收解析详情
	 * @returns 如果文件不存在或解析失败则返回空
	 */
	protected async readDescriptionFile(dir: string, context?: ResolveContext) {
		const cache = this._descriptionFileCache.get(dir)
		if (cache) {
			if (cache instanceof Promise) {
				return await cache
			}
			return cache
		}
		const promise = this._readDescriptionFile(dir, context)
		this._descriptionFileCache.set(dir, promise)
		const result = await promise
		this._descriptionFileCache.set(dir, result)
		return result
	}

	/**
	 * 读取属于某个文件夹的描述文件（如 `package.json`）
	 * @param dir 要查找的文件夹
	 * @param context 解析的上下文对象，用于接收解析详情
	 * @returns 如果文件不存在或解析失败则返回空
	 */
	private async _readDescriptionFile(dir: string, context?: ResolveContext) {
		for (const descriptionFileName of this.descriptionFiles) {
			const descriptionFilePath = join(dir, descriptionFileName)
			let descriptionFileContent: string
			try {
				descriptionFileContent = await this.fs.readFile(descriptionFilePath, "utf-8")
			} catch (e) {
				if (context && context.trace) context.trace.push(e.code !== "ENOENT" ? i18n`Test '${descriptionFilePath}' -> ${e.message}` : i18n`Test '${descriptionFilePath}' -> Not found`)
				continue
			}
			try {
				let descriptionFileData = JSON.parse(descriptionFileContent)
				// 描述文件必须是一个对象
				if (!descriptionFileData || typeof descriptionFileData !== "object") {
					if (context && context.trace) context.trace.push(i18n`Test '${descriptionFilePath}' -> Invalid(Not a object)`)
					descriptionFileData = {}
				}
				descriptionFileData.__path__ = descriptionFilePath
				if (context && context.trace) context.trace.push(i18n`Test '${descriptionFilePath}' -> Ok`)
				return descriptionFileData
			} catch (e) {
				if (context && context.trace) context.trace.push(i18n`Test '${descriptionFilePath}' -> JSON Parsing Error: ${e.message}`)
			}
		}
		return null
	}

	/**
	 * 查找并解析属于某个文件夹的描述文件（如 `package.json`）
	 * @param dir 要查找的文件夹
	 * @param context 解析的上下文对象，用于接收解析详情
	 */
	async lookupDescriptionFile(dir: string, context?: ResolveContext) {
		while (true) {
			// 查找本级
			const descriptionFile = await this.readDescriptionFile(dir, context)
			if (descriptionFile) {
				return descriptionFile
			}
			// 继续查找上级
			const parent = dirname(dir)
			if (parent === dir) {
				break
			}
			dir = parent
		}
		return null
	}

	/**
	 * 获取描述文件中指定字段的值，如果有多个字段则返回第一个存在的值
	 * @param descriptionFileData 描述文件数据
	 * @param fields 要获取的字段名
	 */
	protected getFieldInDescriptionFile(descriptionFileData: Object, fields: string[]) {
		for (const field of fields) {
			if (descriptionFileData.hasOwnProperty(field)) {
				return field
			}
		}
	}

	// #endregion

	// #region IO 缓存

	/**
	 * 存储所有路径读取的缓存
	 * @description
	 * 对象的键是文件或文件夹路径，对象的值可能是：
	 * - `Promise`: 正在计算该文件的数据
	 * - `null`: 该路径不存在
	 * - `true`: 该路径是一个文件
	 * - `false`: 该路径是一个文件夹，但未读取内部文件项
	 * - `Set<string>`: 该路径是一个文件夹，并已缓存了内部文件项
	 */
	private readonly _fsCache = new Map<string, null | boolean | Set<string> | Promise<string[] | Stats>>()

	/** 获取使用的文件系统 */
	readonly fs: FileSystem

	/** 是否忽略路径大小写 */
	readonly ignoreCase: boolean

	/**
	 * 读取文件夹内所有文件的列表
	 * @param path 要读取的路径
	 * @returns 如果文件夹不存在则返回 `null`，如果路径存在但不是文件夹则返回 `false`
	 */
	protected async readDir(path: string) {
		let data = this._fsCache.get(path)
		if (data !== undefined) {
			if (data instanceof Promise) {
				try {
					await data
				} catch  { }
				data = this._fsCache.get(path)
			}
			if (data !== undefined) {
				if (data === true) {
					return false
				}
				if (data !== false) {
					return data as Set<string> | null
				}
			}
		}
		const promise = this.fs.readDir(path)
		this._fsCache.set(path, promise)
		let entries: string[]
		try {
			entries = await promise
		} catch (e) {
			if (e.code === "ENOENT") {
				this._fsCache.set(path, null)
				return null
			}
			this._fsCache.delete(path)
			throw e
		}
		if (this.ignoreCase) {
			data = new Set<string>()
			for (const entry of entries) {
				data.add(entry.toLowerCase())
			}
		} else {
			data = new Set<string>(entries)
		}
		this._fsCache.set(path, data)
		return data
	}

	/**
	 * 判断指定的路径是否是文件
	 * @param path 要判断的路径
	 * @returns 如果文件不存在则返回 `null`，如果路径存在但不是文件则返回 `false`
	 */
	protected async checkFile(path: string): Promise<boolean | null> {
		let data = this._fsCache.get(path)
		if (data !== undefined) {
			if (data instanceof Promise) {
				try {
					await data
				} catch  { }
				data = this._fsCache.get(path)
			}
			if (data !== undefined) {
				if (data === null || data === true) {
					return data as null | true
				}
				return false
			}
		}
		const promise = this.fs.getStat(path)
		this._fsCache.set(path, promise)
		try {
			data = (await promise).isFile()
		} catch (e) {
			if (e.code === "ENOENT") {
				data = null
			} else {
				this._fsCache.delete(path)
				throw e
			}
		}
		this._fsCache.set(path, data)
		return data as null | true
	}

	/**
	 * 清除所有缓存
	 */
	clearCache() {
		this._resolveCache.clear()
		this._fsCache.clear()
		this._descriptionFileCache.clear()
	}

	// #endregion

}

/** 表示模块解析器的配置 */
export interface ResolverOptions {
	/**
	 * 是否允许缓存解析结果
	 * @default true
	 */
	cache?: boolean
	/**
	 * 解析的路径别名
	 * @default { "~": rootDir }
	 * @example
	 * ```
	 * {
	 *      alias: {
	 *          "abc": "xyz", // import "abc/foo" 将等价于 import "xyz/foo"
	 *          "abc$": "xyz", // import "abc" 将等价于 import "xyz"，但 import "abc/foo" 不变
	 *          "tealui-*": "tealui/*",
	 *      }
	 * }
	 * ```
	 */
	alias?: { [name: string]: string | ((input: string, ...parts: string[]) => string) | (string | ((input: string, ...parts: string[]) => string) | false)[] | false }
	/**
	 * `package.json` 中包含 `alias` 信息的字段名
	 * @default ["browser"]
	 */
	aliasFields?: string[]
	/**
	 * 所有描述文件名
	 * @default ["package.json"]
	 */
	descriptionFiles?: string[]
	/**
	 * 是否强制区分路径大小写
	 * @description 设置后可以避免不同环境出现不同的打包结果
	 * @default true
	 */
	enforceCaseSensitive?: boolean
	/**
	 * 是否强制引用模块时使用扩展名
	 * @default false
	 */
	enforceExtension?: boolean
	/**
	 * 解析模块名时尝试自动追加的扩展名
	 * @default [".wasm", ".tsx", ".ts", ".jsx", ".mjs", ".js", ".json"]
	 */
	extensions?: string[]
	/**
	 * `package.json` 中包含入口模块的字段名
	 * @default ["browser", "module", "main"]
	 */
	mainFields?: string[]
	/**
	 * 解析文件夹时默认使用的文件名，其中 `&` 表示所在目录名
	 * @default ["index"]
	 */
	mainFiles?: string[]
	/**
	 * 要搜索的模块文件夹路径
	 * @default ["node_modules"]
	 */
	modules?: string[]
}

/** 用于接收解析详情的上下文对象 */
export interface ResolveContext {
	/** 标记本次解析结果是否来自缓存 */
	cache?: boolean
	/** 存储本次解析的详细日志 */
	trace?: string[]
}