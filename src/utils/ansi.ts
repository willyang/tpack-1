/**
 * 表示控制台颜色
 * @see https://en.wikipedia.org/wiki/ANSI_escape_code
 */
export const enum ConsoleColor {
	/** 黑色 */
	black = 30,
	/** 红色 */
	red = 31,
	/** 绿色 */
	green = 32,
	/** 黄色 */
	yellow = 33,
	/** 蓝色 */
	blue = 34,
	/** 紫色 */
	magenta = 35,
	/** 靛色 */
	cyan = 36,
	/** 白色 */
	white = 37,

	/** 亮黑色（即灰色） */
	brightBlack = 90,
	/** 亮红色 */
	brightRed = 91,
	/** 亮绿色（即青色） */
	brightGreen = 92,
	/** 亮黄色 */
	brightYellow = 93,
	/** 亮蓝色 */
	brightBlue = 94,
	/** 亮紫色 */
	brightMagenta = 95,
	/** 亮靛色 */
	brightCyan = 96,
	/** 亮白色 */
	brightWhite = 97,

	/** 黑色 */
	backgroundBlack = 40,
	/** 背景红色 */
	backgroundRed = 41,
	/** 背景绿色 */
	backgroundGreen = 42,
	/** 背景黄色 */
	backgroundYellow = 44,
	/** 背景蓝色 */
	backgroundBlue = 44,
	/** 背景紫色 */
	backgroundMagenta = 45,
	/** 背景靛色 */
	backgroundCyan = 46,
	/** 背景白色 */
	backgroundWhite = 47,

	/** 背景亮黑色（即灰色） */
	backgroundBrightBlack = 100,
	/** 背景亮红色 */
	backgroundBrightRed = 101,
	/** 背景亮绿色（即青色） */
	backgroundBrightGreen = 102,
	/** 背景亮黄色 */
	backgroundBrightYellow = 103,
	/** 背景亮蓝色 */
	backgroundBrightBlue = 104,
	/** 背景亮紫色 */
	backgroundBrightMagenta = 105,
	/** 背景亮靛色 */
	backgroundBrightCyan = 106,
	/** 背景亮白色 */
	backgroundBrightWhite = 107,
}

/**
 * 添加颜色 ANSI 控制字符
 * @param content 要处理的内容
 * @param color 要添加的颜色
 */
export function color(content: string, color: ConsoleColor) {
	return `\u001b[${color}m${content}\u001b[39m`
}

/**
 * 添加加粗 ANSI 控制字符
 * @param content 要处理的内容
 */
export function bold(content: string) {
	return `\u001b[1m${content}\u001b[0m`
}

/** 匹配 ANSI 控制字符的正则表达式 */
const ansiRegExp = /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=<>~]))/g

/**
 * 删除所有 ANSI 控制字符
 * @param content 要处理的内容
 */
export function removeAnsiCodes(content: string) {
	return content.replace(ansiRegExp, "")
}

/**
 * 如果内容超过最大宽度，则拆成新行
 * @param content 要处理的内容
 * @param indent 新行的缩进空格数
 * @param maxWidth 允许布局的最大宽度（一般地，西文字母宽度为 1，中文文字宽度为 2）
 * @returns 返回一个数组，每项各代表一行的内容
 */
export function splitString(content: string, indent = 0, maxWidth = process.stdout.columns || Infinity) {
	const lines: string[] = []
	let left = 0
	let leftBound = 0
	let currentWidth = 0
	for (let i = 0; i < content.length;) {
		// 跳过 ANSI 控制字符
		const ch = content.charCodeAt(i)
		if (ch === 0x001b || ch === 0x009b) {
			const match = new RegExp(`^${ansiRegExp.source}`).exec(content.slice(i))
			if (match) {
				leftBound = i += match[0].length
				continue
			}
		}
		// 跳过换行符
		if (ch === 10 || ch === 13) {
			if (left < i) lines.push(`${lines.length ? " ".repeat(indent) : ""}${content.slice(left, i)}`)
			if (ch === 13 && content.charCodeAt(i + 1) === 10) i++
			leftBound = left = ++i
			currentWidth = indent
			continue
		}
		// 排版当前字符
		if ((currentWidth += getCharWidth(ch)) < maxWidth) {
			i++
			continue
		}
		// 达到边界
		let skipSpace = false
		if (i === leftBound) {
			// 列宽太小已不能容纳一个字符，强制布局一个字符
			i++
		} else {
			// 尽量在空格处断词，计算实际截断的位置
			const rightBound = i
			while (i > leftBound && content.charCodeAt(i) !== 32 /* */) {
				i--
			}
			// 找不到空格，强制拆分最后一个字符
			if (i === leftBound) {
				i = rightBound
			} else {
				skipSpace = true
			}
		}
		lines.push(`${lines.length ? " ".repeat(indent) : ""}${content.slice(left, i)}`)
		// 跳过空格
		if (skipSpace) {
			i++
		}
		leftBound = left = i
		currentWidth = indent
	}
	if (left < content.length) lines.push(`${lines.length ? " ".repeat(indent) : ""}${content.slice(left, content.length)}`)
	return lines
}

/**
 * 如果内容超过最大宽度，则将中间部分替换为省略号
 * @param content 要处理的内容（不支持换行）
 * @param ellipsis 使用的省略号
 * @param maxWidth 允许布局的最大宽度（一般地，西文字母宽度为 1，中文文字宽度为 2）
 */
export function truncateString(content: string, ellipsis = "...", maxWidth = process.stdout.columns || Infinity) {
	// 删除省略号本身的宽度
	const ellipsisWidth = getStringWidth(ellipsis)
	if (maxWidth <= ellipsisWidth) {
		ellipsis = ellipsis.substr(0, maxWidth - 1)
	}
	maxWidth -= ellipsisWidth
	// 统计所有控制符的位置，删除时保留所有控制符
	const ansiChars: number[] = []; // [开始位置1, 结束位置1, 开始位置2, ...]
	content.replace(ansiRegExp, (source: string, index: number) => {
		ansiChars.push(index, index + source.length - 1)
		return ""
	})
	// 左右逐字排版，超出宽度限制后停止
	let left = 0
	let right = content.length - 1
	let controlLeft = 0
	let controlRight = ansiChars.length - 1
	while (left < right) {
		// 排版左边一个字符
		while (controlLeft < ansiChars.length && ansiChars[controlLeft] === left) {
			left = ansiChars[controlLeft + 1] + 1
			controlLeft += 2
		}
		maxWidth -= getCharWidth(content.charCodeAt(left))
		if (maxWidth <= 0) {
			break
		}
		left++
		// 排版右边一个字符
		while (controlRight >= 0 && ansiChars[controlRight] === right) {
			right = ansiChars[controlRight - 1] - 1
			controlRight -= 2
		}
		maxWidth -= getCharWidth(content.charCodeAt(right))
		if (maxWidth <= 0) {
			break
		}
		right--
	}
	// 如果已排版所有字符串说明不需要追加省略号
	if (left >= right) {
		return content
	}
	// 保留被截断的控制符
	let ansiString = ""
	for (; controlLeft < controlRight; controlLeft += 2) {
		ansiString += content.substring(ansiChars[controlLeft], ansiChars[controlLeft + 1] + 1)
	}
	// 截断并排版
	return `${content.substr(0, left)}${ansiString}${ellipsis}${content.substr(right + 1)}`
}

/**
 * 格式化一个列表
 * @param items 所有列表项
 * @param space 列表每项之间间隔的空格数
 * @param maxWidth 允许布局的最大宽度（一般地，西文字母宽度为 1，中文文字宽度为 2）
 */
export function formatList(items: string[], space = 2, maxWidth = process.stdout.columns || Infinity) {
	if (!items.length) {
		return ""
	}
	const itemWidth = items.reduce((prev, next) => Math.max(prev, getStringWidth(next)), 0) + space
	const maxCount = Math.ceil(maxWidth / itemWidth) || 1
	let result = items[0]
	for (let i = 1; i < items.length; i++) {
		result += i % maxCount === 0 ? "\n" : " ".repeat(itemWidth - getStringWidth(items[i - 1]))
		result += items[i]
	}
	return result
}

/**
 * 格式化一个表格
 * @param rows 所有行组成的数组，数组的每一项是当前行所有列组成的数组
 * @param columnsAlign 指示每列的对齐方式
 * @param headerSeperator 用于区分首行的分隔符
 * @param columnSeperator 每列之间的分隔符
 * @param ellipsis 如果表格总宽不够则压缩内容，压缩使用的省略号
 * @param maxWidth 允许布局的最大宽度（一般地，西文字母宽度为 1，中文文字宽度为 2）
 */
export function formatTable(rows: string[][], columnsAlign?: ("left" | "center" | "right")[], columnSeperator = "  ", headerSeperator = "", ellipsis = "...", maxWidth = process.stdout.columns || Infinity) {
	// 计算列宽
	const columnsWidth: number[] = []
	for (const row of rows) {
		for (let i = 0; i < row.length; i++) {
			columnsWidth[i] = Math.max(columnsWidth[i] || 0, getStringWidth(row[i]))
		}
	}
	if (!columnsWidth.length) {
		return ""
	}
	// 如果列超出则重新分配
	if (Number.isFinite(maxWidth)) {
		const seperatorWidth = getStringWidth(columnSeperator)
		let delta = (columnsWidth.length === 1 ? columnsWidth[0] : columnsWidth.reduce((x, y) => x + seperatorWidth + y)) - maxWidth
		if (delta >= 0) {
			for (let i = columnsWidth.length - 1; i >= 0; i--) {
				if (columnsWidth[i] > delta) {
					columnsWidth[i] -= delta
					break
				} else if (columnsWidth[i] > 5) {
					delta -= columnsWidth[i] - 5
					columnsWidth[i] = 5
				}
			}
		}
	}
	let log = ""
	for (let i = 0; i < rows.length; i++) {
		if (i) {
			log += "\n"
		}
		const row = rows[i]
		for (let j = 0; j < row.length; j++) {
			if (j) {
				log += columnSeperator
			}
			const columnWidth = columnsWidth[j] || 0
			let cell = row[j]
			let actualWidth = getStringWidth(cell)
			if (actualWidth > columnWidth) {
				cell = truncateString(cell, ellipsis, columnWidth)
				actualWidth = columnWidth
			}
			switch (columnsAlign && columnsAlign[j]) {
				case "right":
					log += " ".repeat(columnWidth - actualWidth)
					log += cell
					break
				case "center":
					log += " ".repeat(Math.floor((columnWidth - actualWidth) / 2))
					log += cell
					log += " ".repeat(Math.ceil((columnWidth - actualWidth) / 2))
					break
				default:
					log += cell
					log += " ".repeat(columnWidth - actualWidth)
					break
			}
		}
		// 首行分隔符
		if (headerSeperator && i === 0) {
			log += "\n"
			for (let j = 0; j < columnsWidth.length; j++) {
				if (j) {
					log += columnSeperator
				}
				log += headerSeperator.repeat(columnsWidth[i] || 0)
			}
		}
	}
	return log
}

/**
 * 格式化一个代码片段
 * @param content 要格式化的内容（不支持 ANSI 控制字符）
 * @param line 开始行号（从 0 开始）
 * @param column 开始列号（从 0 开始）
 * @param endLine 结束行号（从 0 开始）
 * @param endColumn 结束列号（从 0 开始）
 * @param showLine 是否显示行号
 * @param showColumn 是否显示列指示器
 * @param tab 用于代替 TAB 的字符串
 * @param maxWidth 允许布局的最大宽度（一般地，西文字母宽度为 1，中文文字宽度为 2）
 * @param maxHeight 允许布局的最大行数，如果等于 0 则显示所有行
 */
export function formatCodeFrame(content: string, line?: number, column?: number, endLine?: number, endColumn?: number, showLine = true, showColumn = true, tab = "    ", maxWidth = process.stdout.columns || Infinity, maxHeight = 3) {
	// 计算要显示的开始行号
	const firstLine = maxHeight > 0 ? Math.max(0, (line || 0) - Math.floor((maxHeight - 1) / 2)) : 0
	// 存储所有行的数据
	const lines: string[] = []
	// 提取要显示的行的数据
	let lineNumber = 0
	for (let lastIndex = 0, i = 0; i <= content.length; i++) {
		const ch = content.charCodeAt(i)
		if (ch === 13 /*\r*/ || ch === 10 /*\n*/ || ch !== ch /*NaN*/) {
			// 只处理 firstLine 之后的行
			if (lineNumber >= firstLine) {
				// 保存当前行的数据
				lines.push(content.substring(lastIndex, i))
				if (maxHeight > 0 && lines.length >= maxHeight) {
					break
				}
			}
			// 处理换行
			if (ch === 13 /*\r*/ && content.charCodeAt(i + 1) === 10 /*\n*/) {
				i++
			}
			lastIndex = i + 1
			lineNumber++
		}
	}
	// 用于显示行号的宽度
	const lineNumberWidth = showLine ? (lineNumber + 1).toString().length : 0
	maxWidth -= lineNumberWidth + " >  | ".length + 1
	// 计算要显示的开始列号
	let firstColumn = 0
	const selectedLine = lines[line! - firstLine]
	if (selectedLine != undefined && column != undefined) {
		// 确保 firstColumn 和 startColumn 之间的距离 < columns / 2
		let leftWidth = Math.floor(maxWidth / 2)
		for (firstColumn = Math.min(column, selectedLine.length - 1); firstColumn > 0 && leftWidth > 0; firstColumn--) {
			leftWidth -= getCharWidth(selectedLine.charCodeAt(firstColumn))
		}
	}
	// 存储最终结果
	let result = ""
	// 生成每一行的数据
	for (let i = 0; i < lines.length; i++) {
		const currentLine = lines[i]
		lineNumber = firstLine + i
		// 插入换行
		if (i > 0) {
			result += "\n"
		}
		// 生成行号
		if (showLine) {
			result += `${lineNumber === line ? " > " : "   "}${" ".repeat(lineNumberWidth - (lineNumber + 1).toString().length)}${lineNumber + 1} | `
		}
		// 生成数据
		let columnMarkerStart: number | undefined
		let columnMarkerEnd: number | undefined
		let currentWidth = 0
		for (let j = firstColumn; j <= currentLine.length; j++) {
			// 存储占位符的位置
			if (lineNumber === line) {
				if (j === column) {
					columnMarkerStart = currentWidth
				}
				if (line === endLine && j >= column! && j <= endColumn!) {
					columnMarkerEnd = currentWidth
				}
			}
			// 超出宽度后停止
			const ch = currentLine.charCodeAt(j)
			if (ch !== ch /*NaN*/ || (currentWidth += getCharWidth(ch)) > maxWidth) {
				break
			}
			// 将 TAB 转为空格
			if (ch === 9 /*\t*/) {
				result += tab
				continue
			}
			// 转换控制字符
			if (ch === 0x1b || ch === 0x9b) {
				result += "␛"
				continue
			}
			result += currentLine.charAt(j)
		}
		// 生成行指示器
		if (showColumn && lineNumber === line && columnMarkerStart != undefined) {
			result += "\n"
			if (showLine) {
				result += `   ${" ".repeat(lineNumberWidth)} | `
			}
			result += `${" ".repeat(columnMarkerStart)}${columnMarkerEnd! > columnMarkerStart ? "~".repeat(columnMarkerEnd! - columnMarkerStart) : "^"}`
		}
	}
	return result
}

/**
 * 将 ANSI 控制字符转为等效的 HTML 代码
 * @param content 要转换的内容
 * @param colors 自定义各颜色的替代色
 * @param context 如果需要串联两段 HTML，则需要在两次转换时传入相同的引用
 */
export function ansiToHTML(content: string, colors?: { [key: string]: string }, context: { [key: string]: string } = {}) {
	let currentStyle = ""
	content = content.replace(ansiRegExp, all => {
		if (all.startsWith("\u001b[") && all.endsWith("m")) {
			// 自定义颜色
			const match = /^\u001b\[([34])8;(?:5;(\d+)|2;(\d+);(\d+);(\d+))/.exec(all)
			if (match) {
				const color = match[2] ? codeToRGB(parseInt(match[2])) : `#${(parseInt(match[3]) << 16 | parseInt(match[4]) << 8 | parseInt(match[5])).toString(16).padStart(6, "0")}`
				context[match[1] === '4' ? "background-color" : "color"] = colors && colors[color] || color
			} else {
				all.replace(/\d+/g, ansiCode => {
					const code = parseInt(ansiCode)
					if (code >= 30 && code <= 37) {
						const color = codeToRGB(code - 30)
						context["color"] = colors && colors[color] || color
					} else if (code >= 40 && code <= 47) {
						const color = codeToRGB(code - 40)
						context["background-color"] = colors && colors[color] || color
					} else if (code >= 90 && code <= 97) {
						const color = codeToRGB(code - 90 + 8)
						context["color"] = colors && colors[color] || color
					} else if (code >= 100 && code <= 107) {
						const color = codeToRGB(code - 100 + 8)
						context["background-color"] = colors && colors[color] || color
					} else {
						switch (code) {
							case 0:
								for (let key in context) {
									delete context[key]
								}
								break
							case 1:
								context["font-weight"] = "bold"
								break
							case 2:
								context["font-weight"] = "100"
								break
							case 3:
								context["font-style"] = "italic"
								break
							case 4:
								context["text-decoration"] = "underline"
								break
							case 7:
								[context["background-color"], context["color"]] = [context["color"], context["background-color"]]
								break
							case 8:
								context["display"] = "none"
								break
							case 9:
								context["text-decoration"] = "line-through"
								break
							case 21:
							case 22:
								delete context["font-weight"]
								break
							case 23:
								delete context["font-style"]
								break
							case 24:
								delete context["text-decoration"]
								break
							case 39:
								delete context["color"]
								break
							case 49:
								delete context["background-color"]
								break
							case 53:
								context["text-decoration"] = "overline"
								break
						}
						return ""
					}
					return ""
				})
			}
			let style = ""
			for (const key in context) {
				if (style) style += `; `
				style += `${key}: ${context[key]}`
			}
			if (currentStyle === style) {
				return ""
			}
			const oldStyle = currentStyle
			currentStyle = style
			return `${oldStyle ? `</span>` : ""}${style ? `<span style="${style}">` : ""}`

			/** 计算一个颜色简码对应的实际颜色 */
			function codeToRGB(code: number) {
				// 算法参考 https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit
				switch (code) {
					case 1: return "black"
					case 2: return "darkred"
					case 3: return "darkgreen"
					case 4: return "olive"
					case 5: return "darkblue"
					case 6: return "darkmagenta"
					case 7: return "darkcyan"

					case 8: return "gray"
					case 9: return "red"
					case 10: return "green"
					case 11: return "yellow"
					case 12: return "blue"
					case 13: return "magenta"
					case 14: return "cyan"
				}
				if (code >= 232) {
					return `#${((code - 232) * 10 + 8).toString(16).padStart(2, "0").repeat(3)}`
				}
				code -= 16
				const b = code % 6
				code = (code - b) / 6
				const g = code % 6
				code = (code - g) / 6
				const r = code % 6
				return `#${((r > 0 ? r * 40 + 55 : 0) << 16 | (g > 0 ? g * 40 + 55 : 0) << 8 | (b > 0 ? b * 40 + 55 : 0)).toString(16).padStart(6, "0")}`
			}
		}
		return ""
	})
	if (currentStyle) {
		content += "</span>"
	}
	return content
}

/**
 * 获取指定字符串的显示宽度
 * @param content 要计算的内容
 */
export function getStringWidth(content: string) {
	content = removeAnsiCodes(content)
	let result = 0
	for (let i = 0; i < content.length; i++) {
		result += getCharWidth(content.charCodeAt(i))
	}
	return result
}

/**
 * 获取指定字符的显示宽度
 * @param char 要计算的 Unicode 字符编码
 * @description 一般地，西文字母返回 1，中文文字返回 2
 */
export function getCharWidth(char: number) {
	if (char <= 0x1f || (char >= 0x7f && char <= 0x9f)) {
		if (char === 9 /*\t*/) {
			return 4
		}
		return 1
	}
	// 对于 Unicode 代理区（Surrogate）字符（如 Emoji），计算的逻辑比较复杂
	// 考虑此函数主要用于确保在控制台不换行，因此代理区字符统按宽度 2 处理
	if (isFullWidthCodePoint(char)) {
		return 2
	}
	return 1
}

/**
 * 判断指定的字符是否是宽字符
 * @param char 要判断的字符编码
 * @see https://github.com/nodejs/io.js/blob/cff7300a578be1b10001f2d967aaedc88aee6402/lib/readline.js#L1369
 */
function isFullWidthCodePoint(char: number) {
	// http://www.unicode.org/Public/UNIDATA/EastAsianWidth.txt
	return char >= 0x1100 && (
		// CJK Unified Ideographs .. Yi Radicals
		0x4e00 <= char && char <= 0xa4c6 ||
		// Hangul Jamo
		char <= 0x115f ||
		// LEFT-POINTING ANGLE BRACKET
		0x2329 === char ||
		// RIGHT-POINTING ANGLE BRACKET
		0x232a === char ||
		// CJK Radicals Supplement .. Enclosed CJK Letters and Months
		(0x2e80 <= char && char <= 0x3247 && char !== 0x303f) ||
		// Enclosed CJK Letters and Months .. CJK Unified Ideographs Extension A
		0x3250 <= char && char <= 0x4dbf ||
		// Hangul Jamo Extended-A
		0xa960 <= char && char <= 0xa97c ||
		// Hangul Syllables
		0xac00 <= char && char <= 0xd7a3 ||
		// CJK Compatibility Ideographs
		0xf900 <= char && char <= 0xfaff ||
		// Vertical Forms
		0xfe10 <= char && char <= 0xfe19 ||
		// CJK Compatibility Forms .. Small Form Variants
		0xfe30 <= char && char <= 0xfe6b ||
		// Halfwidth and Fullwidth Forms
		0xff01 <= char && char <= 0xff60 ||
		0xffe0 <= char && char <= 0xffe6 ||
		// Kana Supplement
		0x1b000 <= char && char <= 0x1b001 ||
		// Enclosed Ideographic Supplement
		0x1f200 <= char && char <= 0x1f251 ||
		// CJK Unified Ideographs Extension B .. Tertiary Ideographic Plane
		0x20000 <= char && char <= 0x3fffd)
}