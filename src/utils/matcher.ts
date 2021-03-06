import { dirname, isAbsolute, sep } from "path"
import { commonDir, containsPath, isCaseInsensitive, relativePath } from "./path"

/**
 * 表示一个路径匹配器
 * @example
 * const matcher = new Matcher()
 * matcher.include("*.js")
 * matcher.include("*.jsx")
 * matcher.exclude("y.js")
 * matcher.test("x.js") // true
 * matcher.test("x.jsx") // true
 * matcher.test("y.js") // false
 */
export class Matcher {

	/** 获取通配符的根文件夹路径 */
	readonly cwd: string

	/** 判断是否忽略路径的大小写 */
	readonly ignoreCase: boolean

	/**
	 * 初始化新的匹配器
	 * @param options 附加选项
	 */
	constructor(options?: MatcherOptions) {
		this.cwd = options && options.cwd || ""
		this.ignoreCase = options && options.ignoreCase !== undefined ? options.ignoreCase : isCaseInsensitive
	}

	/** 所有已解析的模式 */
	private patterns?: ResolvedPattern

	/** 获取排除匹配器 */
	excludeMatcher?: Matcher

	/**
	 * 添加一个匹配模式
	 * @param pattern 要添加的匹配模式
	 */
	include(pattern: Pattern) {
		if (typeof pattern === "string") {
			if (pattern.charCodeAt(0) === 33 /*!*/) {
				this.exclude(pattern.slice(1))
			} else {
				this._addPattern(globToRegExp(pattern, this))
			}
		} else if (Array.isArray(pattern)) {
			for (const item of pattern) {
				this.include(item)
			}
		} else if (pattern instanceof RegExp) {
			this._addPattern({
				test: this.cwd ? path => pattern.test(relativePath(this.cwd, path)) : path => pattern.test(path),
				base: this.cwd
			})
		} else if (typeof pattern === "function") {
			this._addPattern({
				test: pattern,
				base: this.cwd
			})
		} else if (pattern instanceof Matcher) {
			for (let item = pattern.patterns; item; item = (item as ResolvedPattern).next) {
				this._addPattern({
					test: item instanceof RegExp ? path => item!.test(path) : item.test,
					base: item.base || pattern.cwd
				})
			}
			if (pattern.excludeMatcher) {
				this.exclude(pattern.excludeMatcher)
			}
		}
	}

	/** 底层添加一个模式 */
	private _addPattern(pattern: ResolvedPattern) {
		let prev = this.patterns
		if (prev) {
			while (prev.next) {
				prev = prev.next
			}
			prev.next = pattern
		} else {
			this.patterns = pattern
		}
	}

	/**
	 * 添加一个排除模式
	 * @param pattern 要排除的模式
	 */
	exclude(pattern: Pattern) {
		(this.excludeMatcher || (this.excludeMatcher = new Matcher(this))).include(pattern)
	}

	/**
	 * 判断当前匹配器是否可以匹配指定的路径
	 * @param path 要判断的路径
	 * @param args 传递给自定义函数的参数
	 */
	test(path: string, ...args: any[]) {
		for (let pattern = this.patterns; pattern; pattern = pattern.next) {
			if (pattern.test(path, ...args)) {
				if (this.excludeMatcher && this.excludeMatcher.test(path, ...args)) {
					return false
				}
				return true
			}
		}
		return false
	}

	/** 获取所有模式的公共基路径 */
	get base() {
		let result: string | null = null
		for (let pattern = this.patterns; pattern; pattern = pattern.next) {
			if (result === null) {
				result = pattern.base
			} else {
				result = commonDir(result, pattern.base, this.ignoreCase)
				if (result === null) {
					break
				}
			}
		}
		return result
	}

	/** 获取所有模式的所有公共基路径 */
	getBases() {
		const result: string[] = []
		outer: for (let pattern = this.patterns; pattern; pattern = pattern.next) {
			const base = pattern.base
			for (let i = 0; i < result.length; i++) {
				if (containsPath(result[i], base, this.ignoreCase)) {
					continue outer
				}
				if (containsPath(base, result[i], this.ignoreCase)) {
					result[i] = base
					continue outer
				}
			}
			result.push(base)
		}
		return result
	}

	/**
	 * 根据模式计算匹配结果的基路径
	 * @param path 要获取的路径
	 * @returns 如果没有匹配的基路径则返回空
	 */
	baseOf(path: string) {
		let result: string | null = null
		for (let pattern = this.patterns; pattern; pattern = pattern.next) {
			const base = pattern.base
			if ((result === null || base.length > result.length) && containsPath(base, path)) {
				result = base
			}
		}
		return result
	}

	/**
	 * 根据模式计算匹配结果的相对路径
	 * @param path 要获取的路径
	 * @returns 如果没有匹配的基路径则返回原路径
	 */
	relative(path: string) {
		const base = this.baseOf(path)
		return base ? relativePath(base, path) : path
	}

}

/** 表示匹配器的选项 */
export interface MatcherOptions {
	/**
	 * 如果需要匹配绝对路径，则设置当前根绝对路径
	 */
	cwd?: string
	/**
	 * 是否忽略路径的大小写
	 * @default isCaseInsensitive
	 */
	ignoreCase?: boolean
}

/**
 * 表示一个匹配模式，可以是通配符、正则表达式、自定义函数、匹配器或以上模式组成的数组
 * @description
 * ##### 通配符
 * 在通配符中可以使用以下特殊字符：
 * - `?`: 匹配固定一个字符，但 `/` 和文件名开头的 `.` 除外
 * - `*`: 匹配任意个字符，但 `/` 和文件名开头的 `.` 除外
 * - `**`: 匹配任意个字符，但文件名开头的 `.` 除外
 * - `[abc]`: 匹配方括号中的任一个字符
 * - `[a-z]`: 匹配 a 到 z 的任一个字符
 * - `[!abc]`: 匹配方括号中的任一个字符以外的字符
 * - `{abc,xyz}`: 匹配大括号中的任一种模式
 * - `\`: 表示转义字符，如 `\[` 表示 `[` 按普通字符处理
 * - `!xyz`：如果通配符以 `!` 开头，表示排除匹配的项，注意如果排除了父文件夹，出于性能考虑，无法重新包含其中的子文件
 * 
 * `*` 和 `**` 的区别在于 `**` 可以匹配任意级文件夹，而 `*` 只能匹配一级，但如果通配符中没有 `/`（末尾的除外），`*` 等价于 `**`
 * 
 * 通配符              | 路径               | 结果
 * -------------------|--------------------|--------------
 * usr/*‌/foo.js       | usr/foo.js         | 不匹配
 * usr/*‌/foo.js       | usr/dir/foo.js     | 匹配
 * usr/*‌/foo.js       | usr/dir/sub/foo.js | 不匹配
 * usr/**‌‌/foo.js      | usr/foo.js         | 匹配
 * usr/**‌‌‌/foo.js      | usr/dir/foo.js     | 匹配
 * usr/**‌‌/foo.js      | usr/dir/sub/foo.js | 匹配
 * *.js               | usr/foo.js         | 匹配
 * *.js               | usr/dir/foo.js     | 匹配
 * *.js               | usr/dir/sub/foo.js | 匹配
 * 
 * `*`、`**` 和 `?` 不匹配以 `.` 开头的文件名，要允许匹配，应写成 `{.,}*`
 *
 * 通配符              | 路径               | 结果
 * -------------------|--------------------|--------------
 * *                  | .js                | 不匹配
 * .*                 | .js                | 匹配
 * x*y                | x.y                | 匹配
 * 
 * 如果通配符以 `/` 结尾，表示匹配文件夹和内部所有文件，如果通配符中没有 `?`、`*`、`**`、`[]` 和 `{}`，则通配符按文件夹或文件名处理
 * 
 * 通配符开头可以追加 `./` 表示当前目录，但正文中不允许出现 `./`、`../` 和 `//`，如果需要可以使用 `path.posix.normalize()` 格式化
 * 
 * 默认地，通配符只逐字匹配，如果设置了 `cwd`，则使用绝对路径模式：
 * 1. 只匹配绝对路径，Windows 使用 `\` 作为分隔符
 * 2. 支持前缀 `../`
 * 3. 如果通配符也是绝对路径，则 `[]`、`{}`、`\`（仅 Windows）作普通字符匹配
 *
 * ##### 正则表达式
 * 正则表达式的源是一个固定以 `/` 为分隔符的相对路径
 *
 * ##### 自定义函数
 * 函数接收原始路径为参数，如果函数返回 `true` 表示匹配该路径，如：
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
export type Pattern = string | RegExp | ResolvedPattern["test"] | Matcher | (string | RegExp | ResolvedPattern["test"] | Matcher)[]

/** 表示一个已解析的模式 */
interface ResolvedPattern {
	/**
	 * 测试当前模式是否匹配指定的路径
	 * @param path 要测试的路径
	 * @param args 传递给自定义函数的参数
	 */
	test(path: string, ...args: any[]): boolean
	/** 当前模式的基路径 */
	base: string
	/** 下一个解析模式 */
	next?: ResolvedPattern
}

/** 
 * 将指定的通配符转为等价的正则表达式
 * @param glob 要转换的通配符模式
 * @param options 附加选项
 */
function globToRegExp(glob: string, options: Matcher) {
	let base = options.cwd
	let isAbsoluteGlob: boolean
	let slash: string
	if (base) {
		isAbsoluteGlob = isAbsolute(glob)
		slash = `\\${sep}`
	} else {
		isAbsoluteGlob = false
		slash = "/"
	}
	// 转换正则
	let regexp = ""
	let hasSlash = false
	let endsWithSlash = false
	let hasGlob = false
	let hasStar = false
	let braceCount = 0
	let baseStart = 0
	let baseEnd = 0
	let hasEscape = false
	const end = glob.length - 1
	for (let i = 0; i <= end; i++) {
		const ch = glob.charCodeAt(i)
		switch (ch) {
			case 46 /*.*/:
				// 仅处理开头的 ./ 和 ../
				if (!regexp) {
					// 忽略 ./
					if (glob.charCodeAt(i + 1) === 47 /*/*/) {
						baseStart = i + 2
						i++
						if (i < end) {
							hasSlash = true
						} else {
							endsWithSlash = true
						}
						break
					}
					// 绝对路径模式：处理开头的 ../
					if (base && glob.charCodeAt(i + 1) === 46 /*.*/ && glob.charCodeAt(i + 2) === 47 /*/*/) {
						baseStart = i + 3
						const newBase = dirname(base)
						if (newBase.length !== base.length) {
							i += 2
							if (i < end) {
								hasSlash = true
							} else {
								endsWithSlash = true
							}
							base = newBase
							break
						}
					}
				}
				regexp += "\\."
				break
			case 47 /*/*/:
				if (i < end) {
					hasSlash = true
				} else {
					endsWithSlash = true
				}
				if (!hasGlob) {
					baseEnd = i
				}
				regexp += slash
				break
			case 42 /***/:
				hasGlob = true
				const isStart = i === 0 || glob.charCodeAt(i - 1) === 47 /*/*/
				if (glob.charCodeAt(i + 1) === 42 /***/) {
					i++
					// 为了容错，将 p** 翻译为 p*/**，将 **p 翻译为 **/*p，将 p**q 翻译为 p*/**/*q
					regexp += `${isStart ? "" : `[^${slash}]*`}(?:(?=[^\\.])[^${slash}]*${i < end ? slash : `(?:${slash}|$)`})*`
					if (glob.charCodeAt(i + 1) === 47 /*/*/) {
						i++
						if (i < end) {
							hasSlash = true
						} else {
							endsWithSlash = true
							regexp += "$"
						}
					} else {
						regexp += `(?!\\.)[^${slash}]*`
					}
					break
				}
				hasStar = true
				// 如果是 /*/ 则 * 至少需匹配一个字符
				regexp += `${isStart ? "(?!\\.)" : ""}[^${slash}]${isStart && (i === end || glob.charCodeAt(i + 1) === 47 /*/*/) ? "+" : "*"}`
				break
			case 63 /*?*/:
				hasGlob = true
				regexp += `[^${slash}${i > 0 && glob.charCodeAt(i - 1) !== 47 /*/*/ ? "" : "\\."}]`
				break
			case 92 /*\*/:
				// Windows: 如果通配符是绝对路径，则 \ 作路径分隔符处理
				if (isAbsoluteGlob && sep === "\\") {
					if (i < end) {
						hasSlash = true
					} else {
						endsWithSlash = true
					}
					if (!hasGlob) {
						baseEnd = i
					}
					regexp += slash
					break
				}
				hasEscape = true
				regexp += escapeRegExp(glob.charCodeAt(++i))
				break
			case 91 /*[*/:
				if (!isAbsoluteGlob) {
					const classes = tryParseClasses(glob, i)
					if (classes) {
						hasGlob = true
						regexp += classes[0]
						i = classes[1]
						break
					}
				}
				regexp += "\\["
				break
			case 123 /*{*/:
				if (!isAbsoluteGlob && findCloseBrace(glob, i) >= 0) {
					hasGlob = true
					braceCount++
					regexp += "(?:"
					break
				}
				regexp += "\\{"
				break
			case 44 /*,*/:
				if (braceCount) {
					regexp += "|"
					break
				}
				regexp += ","
				break
			case 125 /*}*/:
				if (braceCount) {
					braceCount--
					regexp += ")"
					break
				}
				regexp += "\\}"
				break
			default:
				regexp += escapeRegExp(ch)
				break
		}
	}
	// 追加后缀
	if (!endsWithSlash && regexp) {
		regexp += hasGlob ? "$" : `(?:$|${slash})`
	}
	// 追加前缀
	if (isAbsoluteGlob) {
		base = ""
		regexp = "^" + regexp
	} else if (hasStar && !hasSlash) {
		regexp = `(?:^|${slash})` + regexp
	} else {
		let prepend = "^"
		if (base) {
			for (let i = 0; i < base.length; i++) {
				prepend += escapeRegExp(base.charCodeAt(i))
			}
			if (!base.endsWith(sep)) prepend += slash
		}
		regexp = prepend + regexp
	}
	// 计算基路径
	if (baseEnd > baseStart) {
		let appendBase = glob.slice(baseStart, baseEnd)
		if (hasEscape) {
			appendBase = appendBase.replace(/\\(.)/g, "$1")
		}
		if (base && !base.endsWith(sep)) {
			base += sep
		}
		base += appendBase
	}
	// 编译正则实例
	const result = new RegExp(regexp, options.ignoreCase ? "i" : "") as Partial<ResolvedPattern> as ResolvedPattern
	result.base = base
	return result
}

/** 尝试从通配符指定位置解析符号组 */
function tryParseClasses(glob: string, startIndex: number): [string, number] | null {
	let classes = ""
	let hasRange = false
	while (++startIndex < glob.length) {
		const ch = glob.charCodeAt(startIndex)
		switch (ch) {
			case 93 /*]*/:
				// []] 的第一个 ] 按普通字符处理
				if (classes) {
					classes = `[${classes}]`
					// [z-a] 是错误的正则，为了确保生成的正则没有语法错误，先测试一次
					if (hasRange) {
						try {
							new RegExp(classes)
						} catch {
							return null
						}
					}
					return [classes, startIndex]
				}
				classes += "\\]"
				break
			case 47 /*/*/:
				return null
			case 45 /*-*/:
				hasRange = true
				classes += "-"
				break
			case 33 /*!*/:
				// [x!] 的 ! 按普通字符处理
				if (classes) {
					classes += "!"
				} else {
					classes += "^"
				}
				break
			case 92 /*\*/:
				classes += escapeRegExp(glob.charCodeAt(++startIndex))
				break
			default:
				classes += escapeRegExp(ch)
				break
		}
	}
	return null
}

/** 搜索对应的关闭大括号 */
function findCloseBrace(glob: string, startIndex: number): number {
	while (++startIndex < glob.length) {
		const ch = glob.charCodeAt(startIndex)
		switch (ch) {
			case 125 /*}*/:
				return startIndex
			case 92 /*\*/:
				startIndex++
				break
			case 91 /*[*/:
				const next = tryParseClasses(glob, startIndex)
				if (next) {
					startIndex = next[1]
				}
				break
			case 123 /*{*/:
				const right = findCloseBrace(glob, startIndex)
				if (right < 0) {
					return right
				}
				startIndex = right
				break
		}
	}
	return -1
}

/** 编码正则表达式中的特殊字符 */
function escapeRegExp(ch: number) {
	return ch === 46 /*.*/ || ch === 92 /*\*/ || ch === 40 /*(*/ || ch === 41 /*)*/ || ch === 123 /*{*/ || ch === 125 /*}*/ || ch === 91 /*[*/ || ch === 93 /*]*/ || ch === 45 /*-*/ || ch === 43 /*+*/ || ch === 42 /***/ || ch === 63 /*?*/ || ch === 94 /*^*/ || ch === 36 /*$*/ || ch === 124 /*|*/ ? `\\${String.fromCharCode(ch)}` : ch !== ch /*NaN*/ ? "\\\\" : String.fromCharCode(ch)
}

/**
 * 测试指定的路径是否符合指定的模式
 * @param path 要测试的路径
 * @param pattern 要测试的匹配模式
 * @param options 附加选项
 */
export function match(path: string, pattern: Pattern, options?: MatcherOptions) {
	const matcher = new Matcher(options)
	matcher.include(pattern)
	return matcher.test(path)
}

/**
 * 判断指定的模式是否是通配符
 * @param pattern 要判断的模式
 */
export function isGlob(pattern: string) {
	for (let i = 0; i < pattern.length; i++) {
		switch (pattern.charCodeAt(i)) {
			case 42 /***/:
			case 63 /*?*/:
			case 92 /*\*/:
				return true
			case 91 /*[*/:
				if (tryParseClasses(pattern, i)) {
					return true
				}
				break
			case 123 /*{*/:
				if (findCloseBrace(pattern, i) >= 0) {
					return true
				}
				break
			case 33 /*!*/:
				if (i === 0) {
					return true
				}
				break
		}
	}
	return false
}