import signalExit from "signal-exit"

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