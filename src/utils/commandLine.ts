import signalExit = require("signal-exit")

/**
 * 清除命令行（含缓存）
 * @param stream 输出流
 */
export function clear(stream = process.stdout) {
	if (stream.isTTY) {
		stream.write("\x1b[2J\x1b[3J")
	}
}

/**
 * 显示命令行的光标
 * @param stream 输出流
 */
export function showCursor(stream = process.stdout) {
	if (stream.isTTY) {
		stream.write("\u001b[?25h")
		if ((stream as ExtendedStream).__showCursor__) {
			(stream as ExtendedStream).__showCursor__!()
			delete (stream as ExtendedStream).__showCursor__
		}
	}
}

/**
 * 隐藏命令行的光标
 * @param stream 输出流
 */
export function hideCursor(stream = process.stdout) {
	if (stream.isTTY) {
		process.stdout.write("\u001b[?25l")
		if (!(stream as ExtendedStream).__showCursor__) {
			(stream as ExtendedStream).__showCursor__ = signalExit(() => {
				delete (stream as ExtendedStream).__showCursor__
				showCursor(stream)
			})
		}
	}
}

interface ExtendedStream {
	__showCursor__?: () => void
}

/**
 * 等待并读取命令行输入
 * @param message 提示的信息
 */
export async function prompt(message: string) {
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