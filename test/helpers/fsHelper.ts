import * as assert from "assert"
import fs = require("fs")
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
	await retryIfError(() => { deleteEntry(root) })
	await retryIfError(() => { createEntries(entries, root) })
	await retryIfError(() => { cwd = process.cwd() })
	await retryIfError(() => { changeDir(root) })
}

/** 表示一个文件项 */
export interface FileEntries {
	[path: string]: string | FileEntries
}

/** 删除用于测试的文件 */
export async function uninit() {
	if (cwd) {
		await retryIfError(() => { changeDir(cwd) })
		await retryIfError(() => { deleteEntry(root) })
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
	if (fs.lstatSync(path).isDirectory()) {
		for (const entry of fs.readdirSync(path)) {
			deleteEntry(join(path, entry))
		}
		fs.rmdirSync(path)
	} else {
		fs.unlinkSync(path)
	}
}

/**
 * 更改当前的工作目录
 * @param cwd 新工作目录
 */
function changeDir(cwd: string) {
	try {
		return process.chdir(cwd)
	} catch (e) {
		if (e.code === "ENOENT") {
			fs.mkdirSync(cwd)
			process.chdir(cwd)
		}
		if (process.cwd() !== cwd) {
			throw e
		}
	}
}

/**
 * 执行指定的函数，如果执行出错则重试
 * @param callback 要执行的函数
 * @param times 重试的次数
 */
function retryIfError<T>(callback: () => T, times = 3) {
	return new Promise<T>((resolve, reject) => {
		try {
			return resolve(callback())
		} catch (e) {
			if (times > 0) {
				return setTimeout(() => {
					retryIfError(callback, times - 1).then(resolve, reject)
				}, 9)
			}
			reject(e)
		}
	})
}

/**
 * 模拟 IO 错误然后执行函数
 * @param func 要执行的函数
 * @param sysCall 要模拟错误的系统调用
 * @param errorCodes 要模拟的错误代码
 */
export async function simulateIOError<T>(func: () => T | Promise<T>, errorCodes = ["UNKNOWN"]) {
	const originalFS = {}
	for (const key of ["appendFile", "copyFile", "lstat", "mkdir", "readdir", "readFile", "realpath", "rename", "rmdir", "stat", "unlink", "writeFile"]) {
		const original = fs[key]
		originalFS[key] = original
		let index = 0
		fs[key] = (...args: any[]) => {
			if (index < errorCodes.length) {
				const error = new Error("Simulated IO Error") as NodeJS.ErrnoException
				error.code = errorCodes[index++]
				if (args.length && typeof args[args.length - 1] === "function") {
					return args[args.length - 1](error)
				} else {
					throw error
				}
			}
			fs[key] = original
			delete originalFS[key]
			return original(...args)
		}
	}
	fs.realpath.native = fs.realpath
	try {
		return await func()
	} finally {
		for (const key in originalFS) {
			fs[key] = originalFS[key]
		}
	}
}