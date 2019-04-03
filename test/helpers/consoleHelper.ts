/**
 * 执行函数并捕获控制台输出内容
 * @param func 要执行的函数
 * * @param outputs 接收捕获的控制台输出内容
 * @returns 返回原函数的返回值
 */
export async function redirectStdio(func: (stdout: (string | Buffer)[], stderr: (string | Buffer)[]) => any) {
	const stdouts: (string | Buffer)[] = []
	const stderrs: (string | Buffer)[] = []
	const oldStdoutWrite = process.stdout.write
	const oldStdErrorWrite = process.stderr.write
	process.stdout.write = (buffer: string | Buffer, cb1?: string | Function, cb2?: Function) => {
		if (buffer && buffer.length) {
			stdouts.push(buffer.toString())
		}
		if (typeof cb1 === "function") {
			cb1()
		}
		if (typeof cb2 === "function") {
			cb2()
		}
		return true
	}
	process.stderr.write = (buffer: string | Buffer, cb1?: string | Function, cb2?: Function) => {
		if (buffer && buffer.length) {
			stderrs.push(buffer.toString())
		}
		if (typeof cb1 === "function") {
			cb1()
		}
		if (typeof cb2 === "function") {
			cb2()
		}
		return true
	}
	try {
		return await func(stdouts, stderrs)
	} finally {
		process.stdout.write = oldStdoutWrite
		process.stderr.write = oldStdErrorWrite
	}
}