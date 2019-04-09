import { bold, color, ConsoleColor, ellipsisString, formatCodeFrame, removeAnsiCodes } from "../utils/ansi"
import { clear, hideCursor, showCursor } from "../utils/commandLine"
import { formatDate } from "../utils/misc"
import { relativePath, resolvePath } from "../utils/path"
import { i18n } from "./i18n"

/** 表示一个日志记录器 */
export class Logger {

	// #region 选项

	/**
	 * 初始化新的日志输出器
	 * @param options 附加选项
	 */
	constructor(options: LoggerOptions = {}) {
		// @ts-ignore
		this.logLevel = options.logLevel !== undefined ? typeof options.logLevel === "string" ? LogLevel[options.logLevel] : options.logLevel : LogLevel.log
		this.ignore = options.ignore ? options.ignore instanceof RegExp ? log => (options.ignore as RegExp).test(log.message || "") : options.ignore : undefined
		this.colors = options.colors !== undefined ? options.colors : process.stdout.isTTY === true && !process.env["NODE_DISABLE_COLORS"]
		this.printFullPath = !!options.printFullPath
		this.baseDir = options.baseDir || process.cwd()
		this.codeFrame = !!options.codeFrame
		this.codeFrameOptions = { columns: process.stdout.columns, rows: 3, showLine: true, showColumn: true, tab: "    ", ...(typeof options.codeFrame === "object" ? options.codeFrame : null) }
		this.persistent = options.persistent !== undefined ? options.persistent : process.stdout.isTTY !== true
		this.spinner = options.spinner !== undefined ? options.spinner : process.stdout.isTTY === true
		this.spinnerFrames = options.spinnerFrames || (process.platform === "win32" && /^\d\./.test(require("os").release()) ? ["-", "\\", "|", "/"] : ["⠋ ", "⠙ ", "⠹ ", "⠸ ", "⠼ ", "⠴ ", "⠦ ", "⠧ ", "⠇ ", "⠏ "])
		this.spinnerInterval = options.spinnerInterval || 90
		// @ts-ignore
		this.spinnerColor = options.spinnerColor !== undefined ? typeof options.spinnerColor === "string" ? ConsoleColor[options.spinnerColor] : options.spinnerColor : ConsoleColor.brightCyan
		this.successIcon = options.successIcon !== undefined ? options.successIcon : process.platform === "win32" ? "✔ " : "√ "
		this.warningIcon = options.warningIcon !== undefined ? options.warningIcon : process.platform === "win32" ? "⚠ " : "⚠️ "
		this.errorIcon = options.errorIcon !== undefined ? options.errorIcon : process.platform === "win32" ? "✘ " : "× "
		this.fatalIcon = options.fatalIcon !== undefined ? options.fatalIcon : this.errorIcon
	}

	// #endregion

	// #region 日志

	/**
	 * 记录一条详细日志
	 * @param log 要记录的日志或错误对象
	 */
	verbose(log: string | Error | LogEntry) {
		return this.write(log, LogLevel.verbose)
	}

	/**
	 * 记录一条普通日志
	 * @param log 要记录的日志或错误对象
	 */
	log(log: string | Error | LogEntry) {
		return this.write(log, LogLevel.log)
	}

	/**
	 * 记录一条信息日志
	 * @param log 要记录的日志或错误对象
	 */
	info(log: string | Error | LogEntry) {
		return this.write(log, LogLevel.info)
	}

	/**
	 * 记录一条成功日志
	 * @param log 要记录的日志或错误对象
	 */
	success(log: string | Error | LogEntry) {
		return this.write(log, LogLevel.success)
	}

	/**
	 * 记录一条警告日志
	 * @param log 要记录的日志或错误对象
	 */
	warning(log: string | Error | LogEntry) {
		return this.write(log, LogLevel.warning)
	}

	/**
	 * 记录一条错误日志
	 * @param log 要记录的日志或错误对象
	 */
	error(log: string | Error | LogEntry) {
		return this.write(log, LogLevel.error)
	}

	/**
	 * 记录一条致命错误日志
	 * @param log 要记录的日志或错误对象
	 */
	fatal(log: string | Error | LogEntry) {
		return this.write(log, LogLevel.fatal)
	}

	/** 获取或设置允许打印的最低日志等级 */
	logLevel: LogLevel

	/**
	 * 判断是否忽略指定日志的回调函数
	 * @param log 日志对象
	 * @param logLevel 日志等级
	 */
	ignore?: (log: LogEntry, logLevel: LogLevel) => boolean

	/** 获取或设置当前错误或警告的编号 */
	errorOrWarningCounter = 0

	/** 在成功日志前追加的前缀 */
	successIcon: string

	/** 在警告日志前追加的前缀 */
	warningIcon: string

	/** 在错误日志前追加的前缀 */
	errorIcon: string

	/** 在致命错误日志前追加的前缀 */
	fatalIcon: string

	/**
	 * 底层实现打印一条日志
	 * @param log 要格式化的日志或错误对象或错误信息
	 * @param level 日志的等级
	 */
	protected write(log: string | Error | LogEntry, level: LogLevel) {
		if (level < this.logLevel || this.ignore && this.ignore(typeof log === "string" ? { message: log } : log instanceof Error ? { error: log, message: log.message, printErrorStack: true } : log, level)) {
			return
		}
		const content = this.formatLog(log)
		switch (level) {
			case LogLevel.error:
				return console.error(`${color(`${++this.errorOrWarningCounter}) ${this.errorIcon}`, ConsoleColor.brightRed)}${content}`)
			case LogLevel.warning:
				return console.warn(`${color(`${++this.errorOrWarningCounter}) ${this.warningIcon}`, ConsoleColor.brightYellow)}${content}`)
			case LogLevel.info:
				return console.info(content)
			case LogLevel.fatal:
				return console.error(`${color(formatDate(new Date(), "[HH:mm:ss]"), ConsoleColor.brightBlack)} ${color(this.fatalIcon, ConsoleColor.brightRed)}${content}`)
			case LogLevel.success:
				return console.info(`${color(formatDate(new Date(), "[HH:mm:ss]"), ConsoleColor.brightBlack)} ${color(this.successIcon, ConsoleColor.brightGreen)}${content}`)
			case LogLevel.verbose:
				return console.debug(`${color(formatDate(new Date(), "[HH:mm:ss]"), ConsoleColor.brightBlack)} ${content}`)
			default:
				return console.log(content)
		}
	}

	/** 判断或设置是否打印带颜色 ANSI 控制符的日志 */
	colors: boolean

	/** 判断或设置是否打印代码片段 */
	codeFrame: boolean

	/** 获取或设置代码片段的选项 */
	codeFrameOptions: Exclude<LoggerOptions["codeFrame"], boolean | undefined>

	/**
	 * 格式化一条日志
	 * @param log 要格式化的日志或错误对象或错误信息
	 * @param colors 是否追加颜色控制符
	 */
	formatLog(log: string | Error | LogEntry, colors = this.colors) {
		let content: string
		if (typeof log === "string") {
			content = log
		} else if (log instanceof Error) {
			content = `${color(`[${log.name}]`, ConsoleColor.brightRed)}${log.message}\n${color(this.formatStack(log.stack || ""), ConsoleColor.brightBlack)}`
		} else {
			content = ""
			// 添加名字
			if (log.source) {
				content += color(`[${log.source}]`, ConsoleColor.brightCyan)
			}
			// 添加路径
			if (log.fileName) {
				content += bold(this.formatPath(log.fileName))
				if (log.line != undefined) {
					let loc = `(${log.line + 1}`
					if (log.column != undefined) {
						loc += `,${log.column + 1}`
					}
					loc += ")"
					content += color(loc, ConsoleColor.brightBlack)
				}
				if (log.message != undefined || log.error) {
					content += color(": ", ConsoleColor.brightBlack)
				}
			}
			// 添加信息
			if (log.message != undefined) {
				content += log.message
			} else if (log.error) {
				content += `${color(`[${log.error.name}]`, ConsoleColor.brightRed)}${log.error.message || ""}`
			}
			// 添加详情
			if (log.detail) {
				content += `\n${color(log.detail, ConsoleColor.brightBlack)}`
			}
			// 添加源代码片段
			if (this.codeFrame) {
				if (log.codeFrame) {
					content += `\n${color(log.codeFrame, ConsoleColor.brightBlack)}`
				} else if (log.codeFrame == undefined && log.content && log.line !== undefined) {
					content += `\n${color(formatCodeFrame(log.content, log.line, log.column, log.endLine, log.endColumn, this.codeFrameOptions.columns, this.codeFrameOptions.rows, this.codeFrameOptions.showLine, this.codeFrameOptions.showColumn, this.codeFrameOptions.tab), ConsoleColor.brightBlack)}`
				}
			}
			// 添加堆栈信息
			const stack = (this.logLevel === LogLevel.verbose || log.printErrorStack) && log.error && this.formatStack(log.error.stack || "")
			if (stack) {
				content += `\n${color(stack, ConsoleColor.brightBlack)}`
			}
		}
		// 去除颜色信息
		if (!colors) {
			content = removeAnsiCodes(content)
		}
		return content
	}

	/**
	 * 格式化指定的错误堆栈信息
	 * @param stack 要格式化的错误堆栈信息
	 */
	formatStack(stack: string) {
		const stacks: string[] = []
		stack.replace(/^    at (.*)$/gm, (stack, line) => {
			if (!/\((?:(?:(?:node|(?:internal\/[\w/]*)?\w+)\.js:\d+:\d+)|native)\)$/.test(line)) {
				stacks.push(color(`    @ ${line}`, ConsoleColor.brightBlack))
			}
			return stack
		})
		return stacks.join("\n")
	}

	/** 判断或设置是否显示完整绝对路径 */
	printFullPath: boolean

	/** 获取或设置路径的基路径 */
	baseDir: string

	/**
	 * 格式化指定的路径
	 * @param path 要格式化的路径
	 */
	formatPath(path: string) {
		if (!this.printFullPath) {
			const relative = relativePath(this.baseDir, path)
			if (!relative.startsWith("../")) {
				return relative
			}
		}
		return resolvePath(path)
	}

	/** 判断或设置是否禁止清除日志 */
	persistent: boolean

	/**
	 * 清除控制台中的所有日志
	 */
	clear() {
		this.errorOrWarningCounter = 0
		if (this.persistent) {
			return
		}
		clear()
	}

	// #endregion

	// #region 进度

	/** 最后一个任务项 */
	private _taskEnd?: { content: string, prev?: Logger["_taskEnd"], next?: Logger["_taskEnd"] }

	/** 获取或设置是否打印进度指示器 */
	spinner: boolean

	/**
	 * 记录将开始执行指定的任务并返回任务编号
	 * @param log 要记录的日志或错误对象
	 */
	begin(log: string | Error | LogEntry) {
		const content = this.formatLog(log)
		if (this.logLevel === LogLevel.verbose) {
			this.verbose(`${color(i18n`Starting`, ConsoleColor.brightMagenta)} ${content}`)
		} else if (this.logLevel < LogLevel.silent && this.spinner) {
			this.showSpinner(content)
		}
		// 添加节点
		const node: Logger["_taskEnd"] = { content }
		if (this._taskEnd) {
			this._taskEnd.next = node
			node.prev = this._taskEnd
			this._taskEnd = node
		} else {
			this._taskEnd = node
		}
		return node
	}

	/**
	 * 记录指定的任务已结束
	 * @param task 要结束的任务编号
	 */
	end(taskId: ReturnType<Logger["begin"]>) {
		const { prev, next } = taskId
		if (prev) {
			prev.next = next
		}
		if (next) {
			next.prev = prev
		} else if (this._taskEnd === taskId) {
			this._taskEnd = prev
		}
		if (this.logLevel === LogLevel.verbose) {
			this.verbose(`${color(formatDate(new Date(), "[HH:mm:ss]"), ConsoleColor.brightBlack)} ${color(i18n`Finished`, ConsoleColor.brightMagenta)} ${taskId.content}`)
		}
		if (this._taskEnd) {
			if (this._spinnerTimer) {
				this.showSpinner(this._taskEnd.content)
			}
		} else {
			this.hideSpinner()
		}
	}

	/**
	 * 重置所有任务
	 */
	reset() {
		if (this._taskEnd) {
			this._taskEnd = undefined
			this.hideSpinner()
		}
	}

	/** 当前进度指示器的文案 */
	private _spinnerText?: string

	/** 当前进度的百分比 */
	private _progressPercent?: number

	/** 缓存已计算的进度条文案 */
	private _resolvedSpinnerText?: string

	/** 存储进度指示器的计时器 */
	private _spinnerTimer?: ReturnType<typeof setInterval>

	/** 原输出流写入函数 */
	private _oldStdoutWrite?: typeof process.stdout.write

	/** 原错误流写入函数 */
	private _oldStderrWrite?: typeof process.stderr.write

	/** 获取或设置进度指示器更新的间隔毫秒数 */
	spinnerInterval: number

	/**
	 * 显示或更新进度指示器文案
	 * @param spinnerText 要显示的文案
	 */
	showSpinner(spinnerText: string) {
		this._spinnerText = spinnerText
		this._resolvedSpinnerText = undefined
		if (this._spinnerTimer) {
			return
		}
		hideCursor()
		// 劫持 write 等函数，如果发现有新内容输出则先暂时关闭进度条
		const oldStdoutWrite: Function = this._oldStdoutWrite = process.stdout.write
		process.stdout.write = function () {
			oldStdoutWrite.call(this, "\u001b[0J")
			return oldStdoutWrite.apply(this, arguments)
		}
		const oldStderrWrite: Function = this._oldStderrWrite = process.stderr.write
		process.stderr.write = function () {
			oldStderrWrite.call(this, "\u001b[0J")
			return oldStderrWrite.apply(this, arguments)
		}
		this._spinnerTimer = setInterval(this._updateSpinner, this.spinnerInterval)
	}

	/** 存储进度指示器的当前桢号 */
	private _spinnerFrameIndex = -1

	/** 获取或设置进度指示器的所有桢 */
	spinnerFrames: string[]

	/** 获取或设置进度指示器的颜色 */
	spinnerColor: ConsoleColor

	/** 更新进度指示器 */
	private _updateSpinner = () => {
		let index = ++this._spinnerFrameIndex
		if (index === this.spinnerFrames.length) {
			this._spinnerFrameIndex = index = 0
		}
		if (this._resolvedSpinnerText == undefined) {
			let content = ""
			if (this._progressPercent != undefined) {
				if (this._progressPercent < 10) {
					content = " "
				}
				content += `${this._progressPercent}% `
			}
			if (this._spinnerText != undefined) {
				content += this._spinnerText.replace(/[\n\r][^]*$/, "")
			}
			this._resolvedSpinnerText = ellipsisString(content, (process.stdout.columns || Infinity) - this.spinnerFrames[index].length)
		}
		this._oldStdoutWrite!.call(process.stdout, `\u001b[0J\u001b[${this.spinnerColor}m${this.spinnerFrames[index]}\u001b[39m${this._resolvedSpinnerText}\u001b[1G`)
	}

	/**
	 * 设置当前显示的百分比进度
	 * @param progress 要设置的进度值（0 到 100 之间）
	 */
	progress(progress: number) {
		this._progressPercent = progress
		this._resolvedSpinnerText = undefined
		if (this._spinnerTimer) {
			return
		}
		this.showSpinner("")
	}

	/**
	 * 隐藏进度指示器
	 */
	hideSpinner() {
		if (!this._spinnerTimer) {
			return
		}
		clearInterval(this._spinnerTimer)
		this._oldStdoutWrite!.call(process.stdout, "\u001b[0J")
		process.stdout.write = this._oldStdoutWrite!
		process.stderr.write = this._oldStderrWrite!
		this._resolvedSpinnerText = this._progressPercent = this._spinnerText = this._spinnerTimer = this._oldStderrWrite = this._oldStdoutWrite = undefined
		showCursor()
	}

	// #endregion

}

/** 表示一个日志记录器的选项 */
export interface LoggerOptions {
	/**
	 * 允许打印的最低日志等级
	 * @default "log"
	 */
	logLevel?: LogLevel | keyof typeof LogLevel
	/**
	 * 判断是否忽略指定日志的正则表达式或回调函数
	 * @param log 日志对象
	 * @param logLevel 日志等级
	 */
	ignore?: RegExp | ((log: LogEntry, logLevel: LogLevel) => boolean)
	/**
	 * 是否打印带颜色控制符的日志
	 * @default process.stdout.isTTY && !process.env["NODE_DISABLE_COLORS"]
	 */
	colors?: boolean
	/**
	 * 是否显示完整绝对路径
	 * @default false
	 */
	printFullPath?: boolean
	/**
	 * 显示相对路径时使用的基路径
	 * @default process.cwd()
	 */
	baseDir?: string
	/**
	 * 是否打印代码片段
	 * @default { columns: 0, rows: 3, showLine: true, showColumn: true, sourceMap: true }
	 */
	codeFrame?: boolean | {
		/**
		 * 最大的列数
		 * @default process.stdout.columns || Infinity
		 */
		columns?: number
		/**
		 * 最大的行数
		 * @default 3
		 */
		rows?: number
		/**
		 * 是否打印行指示器
		 * @default true
		 */
		showLine?: boolean
		/**
		 * 是否打印列指示器
		 * @default true
		 */
		showColumn?: boolean
		/**
		 * 打印时用于表示 TAB 的字符串
		 * @default "    "
		 */
		tab?: string
	}
	/**
	 * 是否禁止清除日志
	 * @default false
	 */
	persistent?: boolean
	/**
	 * 是否打印进度指示器
	 * @default process.stdout.isTTY
	 */
	spinner?: boolean
	/**
	 * 进度指示器的所有桢
	 * @default ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
	 */
	spinnerFrames?: string[]
	/**
	 * 进度指示器更新的间隔毫秒数
	 * @default 90
	 */
	spinnerInterval?: number
	/**
	 * 进度指示器的颜色
	 * @default "brightCyan"
	 */
	spinnerColor?: ConsoleColor | keyof typeof ConsoleColor
	/**
	 * 在成功日志前追加的前缀
	 * @default process.platform === "win32" ? "√ " : "√ "
	 */
	successIcon?: string
	/**
	 * 在警告日志前追加的前缀
	 * @default process.platform === "win32" ? "⚠ " : "⚠️ "
	 */
	warningIcon?: string
	/**
	 * 在错误日志前追加的前缀
	 * @default process.platform === "win32" ? "✖ " : "× "
	 */
	errorIcon?: string
	/**
	 * 在致命错误日志前追加的前缀
	 * @default this.errorIcon
	 */
	fatalIcon?: string
}

/** 表示日志的等级 */
export const enum LogLevel {
	/** 详细信息 */
	verbose,
	/** 普通日志 */
	log,
	/** 重要信息 */
	info,
	/** 成功信息 */
	success,
	/** 警告 */
	warning,
	/** 错误 */
	error,
	/** 致命错误 */
	fatal,
	/** 无日志 */
	silent
}

/** 表示一条日志项 */
export interface LogEntry {
	/** 日志的来源 */
	source?: string
	/** 日志的信息 */
	message?: string
	/** 原始错误对象 */
	error?: Error
	/** 是否打印错误堆栈信息 */
	printErrorStack?: boolean
	/** 日志相关的源文件名 */
	fileName?: string
	/** 日志相关的源内容 */
	content?: string
	/** 日志相关的源行号（从 0 开始）*/
	line?: number
	/** 日志相关的源列号（从 0 开始）*/
	column?: number
	/** 日志相关的源结束行号（从 0 开始）*/
	endLine?: number
	/** 日志相关的源结束列号（从 0 开始）*/
	endColumn?: number
	/** 日志的详情 */
	detail?: string
	/** 日志相关的源代码片段 */
	codeFrame?: string
}