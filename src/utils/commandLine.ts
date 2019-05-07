import signalExit = require("signal-exit")

/** 解绑当程序退出后自动还原光标的监听器 */
var removeExitListener: (() => void) | undefined

/** 显示命令行的光标 */
export function showCursor() {
	const stdout = process.stdout
	if (stdout.isTTY) {
		if (removeExitListener) {
			removeExitListener()
			removeExitListener = undefined
		}
		stdout.write("\x1B[?25h")
	}
}

/** 隐藏命令行的光标 */
export function hideCursor() {
	const stdout = process.stdout
	if (stdout.isTTY) {
		if (!removeExitListener) {
			removeExitListener = signalExit(() => {
				removeExitListener = undefined
				stdout.write("\x1B[?25h")
			}, { alwaysLast: true })
		}
		stdout.write("\x1B[?25l")
	}
}

/** 清空命令行（含缓冲区）*/
export function clear() {
	const stdout = process.stdout
	if (stdout.isTTY) {
		stdout.write(process.platform === "win32" ? "\x1B[2J\x1B[0f\x1Bc" : "\x1B[2J\x1B[3J\x1B[H")
	}
}

/**
 * 读取命令行的输入
 * @param message 提示的信息
 */
export async function input(message = "") {
	return new Promise(resolve => {
		const result = (require("readline") as typeof import("readline")).createInterface({
			input: process.stdin,
			output: process.stdout
		})
		result.question(message, answer => {
			result.close()
			resolve(answer)
		})
	})
}

/**
 * 让用户选择一项
 * @param choices 要展示的选择项
 * @param message 提示的信息
 * @param defaultValue 默认值
 */
export async function select(choices: string[], message = "", defaultValue?: string) {
	message = `\n${choices.map((choice, index) => `[${index + 1}] ${choice}`).join("\n")}\n\n${message || ""}`
	while (true) {
		const line = await input(message)
		if (line) {
			const index = +line - 1
			if (index >= 0 && index < choices.length) {
				return choices[index]
			}
			return line
		}
		if (defaultValue !== undefined) {
			return defaultValue
		}
	}
}