import * as assert from "assert"
import * as fs from "fs"
import { join, resolve } from "path"

/** 原工作目录 */
var cwd: string | undefined

/** 用于测试的临时文件夹路径 */
export const root = resolve("__test__")

/**
 * 初始化用于测试的文件
 * @param entries 要创建的文件和文件夹列表
 */
export async function init(entries: FileEntries) {
	await autoRetry(() => { deleteEntry(root) })
	await autoRetry(() => { createEntries(entries, root) })
	cwd = process.cwd()
	await autoRetry(() => { changeDir(root) })
}

/** 表示一个文件项 */
export interface FileEntries {
	[path: string]: string | FileEntries
}

/** 删除用于测试的文件 */
export async function uninit() {
	if (cwd) {
		await autoRetry(() => { changeDir(cwd) })
		await autoRetry(() => { deleteEntry(root) })
		cwd = undefined
	}
}

/**
 * 校验指定的文件项
 * @param entries 要校验的文件项
 * @param dir 根文件夹
 */
export function check(entries: FileEntries, dir = root) {
	for (const key in entries) {
		const entry = entries[key]
		const child = join(dir, key)
		if (typeof entry === "string") {
			assert.strictEqual(fs.readFileSync(child, "utf-8"), entry)
		} else {
			try {
				assert.strictEqual(fs.statSync(child).isDirectory(), true)
			} catch (e) {
				assert.ifError(e)
			}
			check(entry, child)
		}
	}
}

/**
 * 设置当前的工作目录
 * @param path 新工作目录文件夹
 */
function changeDir(path: string) {
	try {
		return process.chdir(path)
	} catch (e) {
		if (e.code === "ENOENT") {
			fs.mkdirSync(path)
			process.chdir(path)
		}
		if (process.cwd() !== path) {
			throw e
		}
	}
}

/**
 * 创建指定的文件和文件夹
 * @param entries 要创建的文件和文件夹列表
 * @param dir 根文件夹
 */
function createEntries(entries: FileEntries, dir = root) {
	try {
		fs.mkdirSync(dir)
	} catch (e) { }
	for (const key in entries) {
		const entry = entries[key]
		const child = resolve(dir, key)
		if (typeof entry === "string") {
			fs.writeFileSync(child, entry)
		} else {
			createEntries(entry, child)
		}
	}
}

/**
 * 删除指定的文件或文件夹
 * @param path 要删除的文件或文件夹路径
 */
function deleteEntry(path: string) {
	if (!fs.existsSync(path)) {
		return
	}
	if (fs.statSync(path).isDirectory()) {
		for (const entry of fs.readdirSync(path)) {
			deleteEntry(join(path, entry))
		}
		fs.rmdirSync(path)
	} else {
		fs.unlinkSync(path)
	}
}

/**
 * 执行指定的函数，如果执行出错则重试
 * @param callback 要执行的函数
 * @param times 重试的次数
 */
function autoRetry(callback, times = 3) {
	return new Promise((resolve, reject) => {
		try {
			return resolve(callback())
		} catch (e) {
			if (times > 0) {
				return setTimeout(() => {
					autoRetry(callback, times - 1).then(resolve, reject)
				}, 9)
			}
			reject(e)
		}
	})
}

/**
 * 模拟 IO 错误状态下执行函数
 * @param func 要执行的函数
 * @param sysCall 要模拟错误的系统调用
 * @param errorCodes 要模拟的错误代码
 */
export async function simulateIOError(func: () => any, sysCall: string, errorCodes = ["UNKNOWN"]) {
	let index = 0
	const original = fs[sysCall]
	fs[sysCall] = (...args: any[]) => {
		if (index >= errorCodes.length) {
			fs[sysCall] = original
			return original(...args)
		}
		const error = new Error("Simulated IO Error") as NodeJS.ErrnoException
		error.code = errorCodes[index++]
		if (typeof args[args.length - 1] === "function") {
			return args[args.length - 1](error)
		} else {
			throw error
		}
	}
	try {
		return await func()
	} finally {
		fs[sysCall] = original
	}
}