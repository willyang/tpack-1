import { isAbsolute, join, posix, resolve, sep } from "path"
import { escapeRegExp } from "./misc"
import { commonDir, containsPath, isCaseInsensitive, relativePath } from "./path"

/**
 * 表示一个路径匹配器
 * @example
 * const matcher = new Matcher()
 * matcher.include("*.js")
 * matcher.include("*.jsx")
 * matcher.exclude("y.js")
 * matcher.test(path.resolve("x.js")) // true
 * matcher.test(path.resolve("y.js")) // false
 */
export class Matcher {

	/** 获取所有已编译的模式 */
	readonly patterns: CompiledPattern[] = []

	/** 获取或设置当前匹配器的排除匹配器 */
	excludeMatcher?: Matcher

	/**
	 * 初始化新的匹配器
	 * @param pattern 要添加的匹配模式
	 * @param options 模式的选项
	 */
	constructor(pattern?: Pattern, options?: PatternOptions) {
		if (pattern != undefined) {
			this.include(pattern, options)
		}
	}

	/**
	 * 添加一个匹配模式
	 * @param pattern 要添加的匹配模式
	 * @param options 模式的选项
	 */
	include(pattern: Pattern, options: PatternOptions = {}) {
		if (typeof pattern === "string") {
			if (pattern.charCodeAt(0) === 33 /*!*/ && !options.noNegate) {
				this.exclude(pattern.slice(1), options)
			} else {
				this.patterns.push(globToRegExp(pattern, options))
			}
		} else if (Array.isArray(pattern)) {
			for (const p of pattern) {
				this.include(p, options)
			}
		} else if (pattern instanceof RegExp) {
			this.patterns.push({
				base: options && options.baseDir ? resolve(options.baseDir) : process.cwd(),
				test(path) {
					return pattern.test(relativePath(this.base, path))
				}
			})
		} else if (typeof pattern === "function") {
			this.patterns.push({
				base: options && options.baseDir ? resolve(options.baseDir) : process.cwd(),
				test: pattern
			})
		} else if (pattern instanceof Matcher) {
			this.patterns.push(...pattern.patterns)
			if (pattern.excludeMatcher) {
				this.exclude(pattern.excludeMatcher, options)
			}
		}
	}

	/**
	 * 添加一个排除模式
	 * @param pattern 要排除的模式
	 * @param options 模式的选项
	 */
	exclude(pattern: Pattern, options?: PatternOptions) {
		(this.excludeMatcher || (this.excludeMatcher = new Matcher())).include(pattern, options)
	}

	/**
	 * 判断当前匹配器是否可以匹配指定的绝对路径
	 * @param fullPath 要判断的绝对路径
	 */
	test(fullPath: string) {
		for (const pattern of this.patterns) {
			if (pattern.test(fullPath)) {
				if (this.excludeMatcher && this.excludeMatcher.test(fullPath)) {
					return false
				}
				return true
			}
		}
		return false
	}

	/**
	 * 获取所有模式的公共基路径
	 */
	get base() {
		if (!this.patterns.length) {
			return process.cwd() + sep
		}
		let result: string | null = this.patterns[0].base
		for (let i = 1; i < this.patterns.length; i++) {
			result = commonDir(result, this.patterns[i].base)
		}
		return result
	}

	/**
	 * 获取所有模式的所有公共基路径
	 * @param ignoreCase 是否忽略路径的大小写
	 */
	getBases(ignoreCase = isCaseInsensitive) {
		const result: string[] = []
		outer: for (const pattern of this.patterns) {
			const base = pattern.base
			for (let i = 0; i < result.length; i++) {
				if (containsPath(result[i], base, ignoreCase)) {
					continue outer
				}
				if (containsPath(base, result[i], ignoreCase)) {
					result[i] = base
					continue outer
				}
			}
			result.push(base)
		}
		return result
	}

	/**
	 * 获取匹配结果应使用的基路径，如果无可用路径则返回空
	 * @param fullPath 要获取的绝对路径
	 */
	baseOf(fullPath: string) {
		let result: string | undefined
		for (let i = 0; i < this.patterns.length; i++) {
			const base = this.patterns[i].base
			if ((!result || base.length > result.length) && containsPath(base, fullPath)) {
				result = base
			}
		}
		return result
	}

	/**
	 * 获取匹配结果应使用的相对路径，如果无可用路径则返回空
	 * @param fullPath 要获取的绝对路径
	 */
	relative(fullPath: string) {
		let result: string | undefined
		for (let i = 0; i < this.patterns.length; i++) {
			const newResult = relativePath(this.patterns[i].base, fullPath)
			if (!newResult) {
				result = ""
				break
			} else if (newResult.startsWith("../") || newResult === "..") {
				continue
			}
			if (!result || newResult.length < result.length) {
				result = newResult
			}
		}
		return result
	}

}

/**
 * 表示一个匹配模式，可以是通配符、正则表达式、自定义函数、匹配器或以上模式组成的数组
 * @description
 * ##### 通配符
 * 在通配符中可以使用以下特殊字符：
 * - `*`: 匹配任意个字符，但 `/` 除外，比如 `usr/*\/foo.js` 匹配 `usr/dir/foo.js`，但不匹配 `usr/foo.js` 和 `usr/dir/sub/foo.js`
 * - `**`: 匹配任意个字符，比如 `usr/**\/foo.js` 可以匹配 `usr/dir/foo.js`、`usr/foo.js` 或 `usr/dir/sub/foo.js`
 * - `?`: 匹配固定一个字符，但 `/` 除外
 * - `[abc]`: 匹配括号中的任一个字符
 * - `[a-z]`: 匹配 a 到 z 的任一个字符
 * - `[!abc]`: 匹配括号中的任一个字符以外的字符
 * - `{abc,xyz}`: 匹配括号中的任一个模式，设置 `noBrace: true` 后 `{` 只作普通字符使用
 * - `\`: 表示转义字符，如 `\[` 表示 `[` 作普通字符使用；Windows 中绝对路径中的 `\` 将作分隔符使用
 * - `!xyz`：如果通配符以 `!` 开头，表示排除匹配的项，注意如果排除了父文件夹，出于性能考虑，无法重新包含其中的子文件，设置 `noNegate: true` 后 `!` 只作普通字符使用
 * - `xyz/`：如果通配符以 `/` 结尾，表示只匹配文件夹
 *
 * `*`、`**` 和 `?` 默认不匹配直接以 `.` 开头的路径，要允许匹配，可以写成 `.*`，或设置 `dot: true`
 *
 * 如果通配符是一个绝对路径，则禁用所有特殊字符，直接匹配对应路径，设置 `noAbsolute: true` 后将不对绝对路径作特殊处理
 *
 * 如果设置 `matchDir: true`，则只要匹配了根文件夹，也认为匹配了内部所有文件
 * 如果通配符中不存在 `*`、`**`、`?`、`[]` 和 `{}`，系统将默认设置 `matchDir: true`，所以 `src` 默认等价于 `src/**`
 *
 * 如果设置 `matchBase: true`，则只要匹配了文件名，也认为匹配该文件
 * 如果通配符中存在 `*` 但不存在 `/`，系统将默认设置 `matchBase: true`，所以 `*.js` 默认等价于 `**\/*.js`
 *
 * ##### 正则表达式
 * 正则表达式的源是一个固定以 `/` 为分隔符的相对路径
 *
 * ##### 自定义函数
 * 函数接收一个绝对路径为参数，如果函数返回 `true` 表示匹配该路径，如：
 * ```js
 * function match(path) {
 *     return path.endsWith(".js")
 * }
 * ```
 *
 * ##### 匹配器
 * 可以从现成匹配器复制新的匹配器
 *
 * ##### 数组
 * 可以将以上模式自由组合成数组，只要匹配数组中任一个模式，就认定匹配当前模式
 */
export type Pattern = RecursiveArray<string | RegExp | ((path: string) => boolean) | Matcher>[0]

interface RecursiveArray<T> extends Array<T | RecursiveArray<T>> { }

/** 表示模式的选项 */
export interface PatternOptions {
	/**
	 * 模式的根路径
	 * @default process.cwd()
	 */
	baseDir?: string
	/**
	 * 是否禁止使用绝对路径，禁止后开头的 `/` 按 `./` 处理，如果启用，Windows 系统下绝对路径将禁用 `\` 转义功能
	 * @default false
	 */
	noAbsolute?: boolean
	/**
	 * 是否禁止通过开头的 `../` 跳出根路径
	 * @default false
	 */
	noBack?: boolean
	/**
	 * 是否禁止将 `!` 解析为非
	 * @default false
	 */
	noNegate?: boolean
	/**
	 * 是否禁用大括号扩展
	 * @default false
	 */
	noBrace?: boolean
	/**
	 * 是否禁用中括号扩展
	 * @default false
	 */
	noBracket?: boolean
	/**
	 * 是否允许通配符 `*` 和 `?` 匹配 `.` 开头的路径
	 * @default false
	 */
	dot?: boolean
	/**
	 * 是否允许通过匹配文件夹直接匹配内部所有子文件
	 * @default false
	 */
	matchDir?: boolean
	/**
	 * 是否只匹配基路径
	 * @default false
	 */
	matchBase?: boolean
	/**
	 * 是否忽略路径的大小写
	 * @default isCaseInsensitive
	 */
	ignoreCase?: boolean
}

/** 表示一个已编译的模式 */
export interface CompiledPattern {
	/** 模式基路径 */
	base: string
	/**
	 * 测试当前模式是否匹配指定的路径
	 * @param fullPath 要测试的绝对路径
	 */
	test(fullPath: string): boolean
}

/** 将指定的通配符转为等价的正则表达式 */
function globToRegExp(pattern: string, options: PatternOptions) {

	// 处理绝对路径
	let glob = pattern
	let baseDir: string
	const abs = !options.noAbsolute && isAbsolute(glob)
	if (abs) {
		baseDir = ""
		// Windows: 允许绝对路径使用 \ 作为分隔符，禁止 \ 作为转义字符
		if (sep !== "/") {
			glob = glob.split(sep).join("/")
		}
	} else {
		baseDir = resolve(options.baseDir || ".")
		if (glob.startsWith("/")) glob = "." + glob
		// 删除多余的 ./ 和 ../
		glob = posix.normalize(glob)
		if (glob === "." || glob === "./") {
			glob = ""
		}
		const match = /^(?:\.\.(\/|$))+/.exec(glob)
		if (match) {
			if (!options.noBack) {
				baseDir = join(baseDir, match[0])
			}
			glob = glob.slice(match[0].length)
		}
		if (!baseDir.endsWith(sep)) {
			baseDir += sep
		}
	}

	// 生成正则表达式
	let regexp = ""
	let openBrace = 0
	let noSpecialChar = true
	let baseEnd = 0
	let hasEscapeChar = false
	let hasStar = false
	patternLoop: for (let i = 0; i < glob.length; i++) {
		switch (glob.charCodeAt(i)) {
			case 47 /*/*/:
				if (noSpecialChar) {
					baseEnd = i
				}
				regexp += `\\${sep}`
				break
			case 42 /***/:
				noSpecialChar = false
				const isStart = i === 0 || glob.charCodeAt(i - 1) === 47 /*/*/
				if (glob.charCodeAt(i + 1) === 42 /***/) {
					i++
					// 为了容错，将 p** 翻译为 p*/**，将 **p 翻译为 **/*p，将 p**q 翻译为 p*/**/*q
					regexp += `${isStart ? "" : `[^\\${sep}]*`}(?:(?=[^${options.dot ? "" : "\\."}])[^\\${sep}]*${i < glob.length - 1 ? `\\${sep}` : `(?:\\${sep}|$)`})*`
					if (glob.charCodeAt(i + 1) === 47 /*/*/) {
						i++
					} else {
						regexp += `${options.dot ? "" : "(?!\\.)"}[^\\${sep}]*`
					}
				} else {
					hasStar = true
					// 如果是 /*/ 则 * 至少需匹配一个字符
					regexp += `${isStart && !options.dot ? "(?!\\.)" : ""}[^\\${sep}]${isStart && (i === glob.length - 1 || glob.charCodeAt(i + 1) === 47 /*/*/) ? "+" : "*"}`
				}
				break
			case 63 /*?*/:
				noSpecialChar = false
				regexp += `[^\\${sep}${options.dot || i > 0 && glob.charCodeAt(i - 1) !== 47 /*/*/ ? "" : "\\."}]`
				break
			case 92 /*\*/:
				if (noSpecialChar) {
					hasEscapeChar = true
				}
				regexp += escapeRegExp(glob.charAt(++i) || "\\")
				break
			case 91 /*[*/:
				// 不处理绝对路径的 [] 字符
				if (!abs && !options.noBracket) {
					// 查找配对的 ]，如果找不到按普通字符处理
					let classes = ""
					let hasRange = false
					classLoop: for (let j = i + 1; j < glob.length; j++) {
						switch (glob.charCodeAt(j)) {
							case 93 /*]*/:
								// []] 的第一个 ] 按普通字符处理
								if (classes) {
									classes = `[${classes}]`
									// [z-a] 是错误的正则，为了确保生成的正则没有语法错误，先测试一次
									if (hasRange) {
										try {
											new RegExp(classes)
										} catch (e) {
											break classLoop
										}
									}
									noSpecialChar = false
									regexp += classes
									i = j
									continue patternLoop
								}
								classes += "\\]"
								break
							case 45 /*-*/:
								classes += "-"
								hasRange = true
								break
							case 33 /*!*/:
								if (j === i + 1 && glob.charCodeAt(j + 1) !== 93 /*]*/) {
									classes += "^"
								} else {
									classes += "!"
								}
								break
							case 92 /*\*/:
								classes += escapeRegExp(glob.charAt(++j) || "\\")
								break
							default:
								classes += escapeRegExp(glob.charAt(j))
								break
						}
					}
				}
				regexp += "\\["
				break
			case 123 /*{*/:
				if (abs || options.noBrace) {
					regexp += "\\{"
				} else {
					noSpecialChar = false
					openBrace++
					regexp += "(?:"
				}
				break
			case 44 /*,*/:
				if (openBrace) {
					regexp += "|"
				} else {
					regexp += ","
				}
				break
			case 125 /*}*/:
				if (openBrace) {
					openBrace--
					regexp += ")"
					break
				}
			// fall through
			default:
				regexp += escapeRegExp(glob.charAt(i))
				break
		}
	}
	while (openBrace) {
		regexp += ")"
		openBrace--
	}
	regexp = (!abs && (options.matchBase === undefined ? hasStar && pattern.indexOf("/") < 0 : options.matchBase) ? `(?:^|\\${sep})` : `^${escapeRegExp(baseDir)}`) + regexp
	if (glob && !glob.endsWith("/")) {
		regexp += (options.matchDir === undefined ? noSpecialChar : options.matchDir) ? `(?:$|\\${sep})` : `$`
	}

	// 生成正则
	const result = new RegExp(regexp, (options.ignoreCase === undefined ? isCaseInsensitive : options.ignoreCase) ? "i" : "") as any as CompiledPattern
	let basePart = noSpecialChar ? glob : glob.slice(0, baseEnd)
	if (hasEscapeChar) {
		basePart = basePart.replace(/\\(.)/g, "$1")
	}
	result.base = join(baseDir, basePart)
	return result
}

/**
 * 测试指定的内容是否符合指定的模式
 * @param value 要测试的内容
 * @param pattern 要测试的匹配模式
 * @param options 模式的选项
 */
export function match(value: string, pattern: Pattern, options?: PatternOptions) {
	value = resolve(value) + (value.endsWith(sep) || value.endsWith("/") || !value || value === "." ? sep : "")
	return new Matcher(pattern, options).test(value)
}

/**
 * 判断指定的模式是否是通配符
 * @param pattern 要判断的模式
 * @param options 模式的选项
 */
export function isGlob(pattern: string, options: Pick<PatternOptions, "noAbsolute" | "noNegate" | "noBrace" | "noBracket"> = {}) {
	if (!options.noAbsolute && isAbsolute(pattern)) {
		return false
	}
	if (!options.noBracket && /\[[^\]]+\]/.test(pattern)) {
		return true
	}
	if (!options.noBrace && /\{.*\}/.test(pattern)) {
		return true
	}
	if (!options.noNegate && pattern.startsWith("!")) {
		return true
	}
	return /[\\\*\?]/.test(pattern)
}