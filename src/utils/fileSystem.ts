import { appendFile, constants, copyFile, link, lstat, mkdir, readdir, readFile, readlink, realpath, rename, rmdir, stat, Stats, symlink, unlink, writeFile } from "fs"
import { dirname, join } from "path"
import { Matcher, Pattern, PatternOptions } from "./matcher"
import { escapeRegExp } from "./misc"
import { isCaseInsensitive } from "./path"

/** 表示一个文件系统 */
export class FileSystem {

	/** 判断当前文件系统是否忽略大小写 */
	readonly isCaseInsensitive = isCaseInsensitive

	/**
	 * 获取文件或文件夹的属性，如果是链接则返回链接实际引用的文件属性
	 * @param path 要获取的路径
	 */
	getStat(path: string) {
		return new Promise<Stats>((resolve, reject) => {
			stat(path, (error, stats) => {
				if (error) {
					reject(error)
				} else {
					resolve(stats)
				}
			})
		})
	}

	/**
	 * 获取文件或文件夹的属性，如果是链接则返回链接本身的文件属性
	 * @param path 要获取的路径
	 */
	getLinkStat(path: string) {
		return new Promise<Stats>((resolve, reject) => {
			lstat(path, (error, stats) => {
				if (error) {
					reject(error)
				} else {
					resolve(stats)
				}
			})
		})
	}

	/**
	 * 判断指定的文件是否存在
	 * @param path 要判断的路径
	 */
	async existsFile(path: string) {
		try {
			return (await this.getStat(path)).isFile()
		} catch (e) {
			if (e.code === "ENOENT") {
				return false
			}
			throw e
		}
	}

	/**
	 * 判断指定的文件夹是否存在
	 * @param path 要判断的路径
	 */
	async existsDir(path: string) {
		try {
			return (await this.getStat(path)).isDirectory()
		} catch (e) {
			if (e.code === "ENOENT") {
				return false
			}
			throw e
		}
	}

	/**
	 * 如果指定的路径不存在则直接返回，否则返回重命名后的新路径
	 * @param path 要测试的文件或文件夹路径
	 * @param append 如果路径已存在则添加的文件名后缀，其中的数字会递增直到文件不存在
	 */
	async ensureNotExists(path: string, append = "_2"): Promise<string> {
		// 如果文件不存在则直接返回
		try {
			await this.getStat(path)
		} catch (e) {
			if (e.code === "ENOENT") {
				return path
			}
		}
		// 尝试重命名
		let newPath = path.replace(new RegExp(`^((?:[^\\\\/]*[\\/\\\\])*[^\\.]*${escapeRegExp(append).replace(/\d+/, ")(\\d+)(")})`), (_, prefix, index, postfix) => {
			append = null!
			return prefix + (+index + 1) + postfix
		})
		if (append) {
			newPath = path.replace(/^(?:[^\\/]*[\/\\])*[^\.]*/, `$&${append}`)
		}
		return await this.ensureNotExists(newPath, append)
	}

	/**
	 * 如果指定的路径所在的文件夹不存在则创建一个
	 * @param path 相关的路径
	 * @returns 如果文件夹创建成功则返回 `true`，否则说明文件夹已存在，返回 `false`
	 */
	ensureDirExists(path: string) {
		return this.createDir(dirname(path))
	}

	/**
	 * 创建一个文件夹
	 * @param path 要创建的文件夹路径
	 * @returns 如果创建成功则返回 `true`，否则说明文件夹已存在，返回 `false`
	 */
	createDir(path: string) {
		return new Promise<boolean>((resolve, reject) => {
			// 取消用户缺少的权限
			mkdir(path, 0o777 & ~process.umask(), error => {
				if (error) {
					switch (error.code) {
						case "ENOENT":
							// Win32 如果路径中含非法字符，可能也会导致 ENOENT
							// http://stackoverflow.com/questions/62771/how-do-i-check-if-a-given-string-is-a-legal-valid-file-name-under-windows/62888
							this.ensureDirExists(path).then(() => {
								this.createDir(path).then(resolve, reject)
							}, () => {
								reject(error)
							})
							break
						case "EEXIST":
							// 路径已存在，测试是否是文件夹
							stat(path, (error2, stats) => {
								if (error2 || !stats.isDirectory()) {
									reject(error)
								} else {
									resolve(false)
								}
							})
							break
						default:
							reject(error)
							break
					}
				} else {
					resolve(true)
				}
			})
		})
	}

	/**
	 * 删除指定的文件夹
	 * @param path 要删除的文件夹路径
	 * @param recursive 是否删除所有所有子文件夹和文件，如果为 `false` 则只删除空文件夹
	 * @returns 返回删除的文件数
	 */
	deleteDir(path: string, recursive = true) {
		return new Promise<number>((resolve, reject) => {
			rmdir(path, error => {
				if (error) {
					switch (error.code) {
						case "ENOENT":
							resolve(0)
							break
						case "ENOTEMPTY":
						case "EEXIST":
							if (recursive) {
								this.cleanDir(path).then(result => {
									this.deleteDir(path, false).then(() => {
										resolve(result)
									}).catch(reject)
								}, () => {
									reject(error)
								})
							} else {
								reject(error)
							}
							break
						default:
							reject(error)
							break
					}
				} else {
					resolve(0)
				}
			})
		})
	}

	/**
	 * 清空指定的文件夹
	 * @param path 要清空的文件夹路径
	 * @returns 返回删除的文件数
	 */
	cleanDir(path: string) {
		return new Promise<number>((resolve, reject) => {
			safeCall(readdir, [path], (error, entries: string[]) => {
				if (error) {
					if (error.code === "ENOENT") {
						resolve(0)
					} else {
						reject(error)
					}
				} else {
					let pending = entries.length
					if (pending) {
						let count = 0
						for (const entry of entries) {
							const child = join(path, entry)
							lstat(child, async (error, stats) => {
								if (error) {
									reject(error)
								} else {
									try {
										if (stats.isDirectory()) {
											const childCount = await this.deleteDir(child)
											count += childCount
										} else {
											await this.deleteFile(child)
											count++
										}
									} catch (e) {
										reject(e)
									}
								}
								if (--pending < 1) {
									resolve(count)
								}
							})
						}
					} else {
						resolve(0)
					}
				}
			})
		})
	}

	/**
	 * 如果父文件夹是空文件夹则删除
	 * @param path 文件夹内的文件路径
	 * @returns 如果删除成功则返回 `true`，否则说明文件夹不空，返回 `false`
	 */
	deleteParentDirIfEmpty(path: string) {
		const parent = dirname(path)
		if (parent === path) {
			return Promise.resolve(false)
		}
		return new Promise<boolean>(resolve => {
			rmdir(parent, error => {
				if (error) {
					resolve(false)
				} else {
					this.deleteParentDirIfEmpty(parent).then(() => {
						resolve(true)
					})
				}
			})
		})
	}

	/**
	 * 删除指定的文件
	 * @param path 要删除的文件路径
	 * @returns 如果删除成功则返回 `true`，否则说明文件不存在，返回 `false`
	 */
	deleteFile(path: string) {
		return new Promise<boolean>((resolve, reject) => {
			unlink(path, error => {
				if (error) {
					switch (error.code) {
						case "ENOENT":
							resolve(false)
							break
						default:
							reject(error)
							break
					}
				} else {
					resolve(true)
				}
			})
		})
	}

	/**
	 * 深度遍历指定的路径并执行回调
	 * @param path 要遍历的文件或文件夹路径
	 * @param options 遍历的选项
	 */
	walk(path: string, options: WalkOptions) {
		return new Promise<void>(resolve => {
			let pending = 0
			walk(path)

			function walk(path: string) {
				pending++
				(options.follow ? stat : lstat)(path, (error, stats) => {
					if (error) {
						options.error && options.error(error, path)
					} else if (stats.isFile()) {
						options.file && options.file(path, stats)
					} else if (stats.isDirectory()) {
						if (!options.dir || options.dir(path, stats) !== false) {
							return safeCall(readdir, [path], (error, entries) => {
								if (error) {
									options.error && options.error(error, path)
								} else if (!options.scan || options.scan(path, entries, stats) !== false) {
									for (const entry of entries) {
										walk(join(path, entry))
									}
								}
								if (--pending < 1) {
									resolve()
								}
							})
						}
					} else {
						options.other && options.other(path, stats)
					}
					if (--pending < 1) {
						resolve()
					}
				})
			}
		})
	}

	/**
	 * 查找匹配指定模式的所有文件
	 * @param pattern 要匹配的模式
	 * @param options 查找的选项
	 * @returns 返回所有匹配文件的绝对路径
	 */
	async glob(pattern: Pattern, options: PatternOptions = {}) {
		const matcher = pattern instanceof Matcher ? pattern : new Matcher(pattern, options)
		const files: string[] = []
		await Promise.all(matcher.getBases(options.ignoreCase).map(base => this.walk(base, {
			dir: matcher.excludeMatcher ? path => !matcher.excludeMatcher!.test(path) : undefined,
			file(path) {
				if (matcher.test(path)) {
					files.push(path)
				}
			},
		})))
		return files
	}

	/**
	 * 获取文件夹内的所有文件和文件夹组成的数组
	 * @param path 要读取的文件夹路径
	 */
	readDir(path: string) {
		return new Promise<string[]>((resolve, reject) => {
			safeCall(readdir, [path], (error, entries) => {
				if (error) {
					reject(error)
				} else {
					resolve(entries)
				}
			})
		})
	}

	/**
	 * 读取指定文件的二进制内容
	 * @param path 要读取的文件路径
	 */
	readFile(path: string): Promise<Buffer>

	/**
	 * 读取指定文件的文本内容
	 * @param path 要读取的文件路径
	 * @param throwOnNotFound 是否在文件不存在时抛出错误
	 */
	readFile(path: string, encoding: string, throwOnNotFound: false): Promise<string | null>

	/**
	 * 读取指定文件的文本内容
	 * @param path 要读取的文件路径
	 * @param throwOnNotFound 是否在文件不存在时抛出错误
	 */
	readFile(path: string, encoding: string, throwOnNotFound?: boolean): Promise<string>

	readFile(path: string, encoding?: string | boolean, throwOnNotFound?: boolean) {
		return new Promise<string | Buffer | null>((resolve, reject) => {
			safeCall(readFile, [path, encoding], (error, entries) => {
				if (error) {
					if (throwOnNotFound === false && error.code === "ENOENT") {
						resolve(null)
					} else {
						reject(error)
					}
				} else {
					resolve(entries)
				}
			})
		})
	}

	/**
	 * 将内容写入指定的文件
	 * @param path 要写入的文件路径
	 * @param data 要写入的文件数据
	 * @param overwrite 是否允许覆盖现有的目标
	 * @returns 如果写入成功则返回 `true`，否则说明目标已存在，返回 `false`
	 */
	writeFile(path: string, data: string | Buffer, overwrite = true) {
		return new Promise<boolean>((resolve, reject) => {
			safeCall(writeFile, [path, data, overwrite ? undefined : { flag: "wx" }], error => {
				if (error) {
					switch (error.code) {
						case "ENOENT":
							this.ensureDirExists(path).then(() => {
								this.writeFile(path, data, overwrite).then(resolve, reject)
							}, () => {
								reject(error)
							})
							break
						case "EEXIST":
							if (overwrite) {
								reject(error)
							} else {
								resolve(false)
							}
							break
						default:
							reject(error)
							break
					}
				} else {
					resolve(true)
				}
			})
		})
	}

	/**
	 * 在指定文件末尾追加内容
	 * @param path 要创建的文件路径
	 * @param data 要写入的文件数据
	 */
	appendFile(path: string, data: string | Buffer) {
		return new Promise<void>((resolve, reject) => {
			safeCall(appendFile, [path, data], error => {
				if (error) {
					switch (error.code) {
						case "ENOENT":
							this.ensureDirExists(path).then(() => {
								this.appendFile(path, data).then(resolve, reject)
							}, () => {
								reject(error)
							})
							break
						default:
							reject(error)
							break
					}
				} else {
					resolve()
				}
			})
		})
	}

	/**
	 * 创建一个链接
	 * @param path 要创建的文件路径
	 * @param target 要链接的目标路径
	 * @param overwrite 是否覆盖已有的目标
	 * @returns 如果创建成功则返回 `true`，否则说明目标已存在，返回 `false`
	 */
	createLink(path: string, target: string, overwrite = true) {
		return new Promise<boolean>((resolve, reject) => {
			lstat(target, (error, stats) => {
				const done = (error: NodeJS.ErrnoException | null) => {
					if (error) {
						switch (error.code) {
							case "ENOENT":
								this.ensureDirExists(path).then(() => {
									this.createLink(path, target, overwrite).then(resolve, reject)
								}, () => {
									reject(error)
								})
								break
							case "EEXIST":
								if (overwrite) {
									this.deleteFile(path).then(() => {
										this.createLink(path, target, false).then(() => {
											resolve(true)
										}, reject)
									}, () => {
										reject(error)
									})
								} else {
									resolve(false)
								}
								break
							default:
								reject(error)
								break
						}
					} else {
						resolve(true)
					}
				}
				if (error || stats.isDirectory()) {
					symlink(target, path, "junction", done)
				} else {
					link(target, path, done)
				}
			})
		})
	}

	/**
	 * 读取链接的实际地址
	 * @param path 要读取的链接路径
	 */
	readLink(path: string) {
		return new Promise<string>((resolve, reject) => {
			safeCall(readlink, [path], (error, link) => {
				if (error) {
					reject(error)
				} else {
					resolve(link)
				}
			})
		})
	}

	/**
	 * 复制指定的文件夹
	 * @param src 要复制的源路径
	 * @param dest 要复制的目标路径
	 * @param overwrite 是否覆盖已有的目标
	 * @returns 返回已复制的文件数
	 */
	copyDir(src: string, dest: string, overwrite = true) {
		return new Promise<number>((resolve, reject) => {
			this.createDir(dest).then(() => {
				safeCall(readdir, [src], (error, entries: string[]) => {
					if (error) {
						reject(error)
					} else {
						let pending = entries.length
						if (pending) {
							let count = 0
							let firstError: NodeJS.ErrnoException
							for (const entry of entries) {
								const fromChild = join(src, entry)
								const toChild = join(dest, entry)
								lstat(fromChild, async (error, stats) => {
									if (error) {
										firstError = firstError || error
									} else {
										try {
											if (stats.isDirectory()) {
												const childCount = await this.copyDir(fromChild, toChild, overwrite)
												count += childCount
											} else if (stats.isSymbolicLink()) {
												if (await this.copyLink(fromChild, toChild, overwrite)) {
													count++
												}
											} else {
												if (await this.copyFile(fromChild, toChild, overwrite)) {
													count++
												}
											}
										} catch (e) {
											firstError = firstError || e
										}
										if (--pending < 1) {
											if (firstError) {
												reject(firstError)
											} else {
												resolve(count)
											}
										}
									}
								})
							}
						} else {
							resolve(0)
						}
					}
				})
			}, reject)
		})
	}

	/**
	 * 复制指定的文件
	 * @param src 要复制的源路径
	 * @param dest 要复制的目标路径
	 * @param overwrite 是否覆盖已有的目标
	 * @returns 如果复制成功则返回 `true`，否则说明目标已存在，返回 `false`
	 */
	copyFile(src: string, dest: string, overwrite = true) {
		return new Promise<boolean>((resolve, reject) => {
			safeCall(copyFile, [src, dest, overwrite ? undefined : constants.COPYFILE_EXCL], error => {
				if (error) {
					switch (error.code) {
						case "ENOENT":
							this.ensureDirExists(dest).then(() => {
								this.copyFile(src, dest, overwrite).then(resolve, reject)
							}, () => {
								reject(error)
							})
							break
						case "EEXIST":
							resolve(false)
							break
						default:
							reject(error)
							break
					}
				} else {
					resolve(true)
				}
			})
		})
	}

	/**
	 * 复制指定的链接
	 * @param src 要复制的源路径
	 * @param dest 要复制的目标路径
	 * @param overwrite 是否覆盖已有的目标
	 * @returns 如果复制成功则返回 `true`，否则说明目标已存在，返回 `false`
	 */
	copyLink(src: string, dest: string, overwrite = true) {
		return new Promise<boolean>((resolve, reject) => {
			this.readLink(src).then(link => {
				this.createLink(dest, link, overwrite).then(resolve, reject)
			}, reject)
		})
	}

	/**
	 * 移动指定的文件夹
	 * @param src 要移动的源路径
	 * @param dest 要移动的目标路径
	 * @param overwrite 是否允许覆盖现有的目标
	 * @returns 返回已移动的文件数
	 */
	moveDir(src: string, dest: string, overwrite = true) {
		return new Promise<number>((resolve, reject) => {
			this.createDir(dest).then(() => {
				safeCall(readdir, [src], (error, entries: string[]) => {
					if (error) {
						reject(error)
					} else {
						let pending = entries.length
						if (pending) {
							let count = 0
							let firstError: NodeJS.ErrnoException
							for (const entry of entries) {
								const fromChild = join(src, entry)
								const toChild = join(dest, entry)
								lstat(fromChild, async (error, stats) => {
									if (error) {
										firstError = firstError || error
									} else {
										try {
											if (stats.isDirectory()) {
												const childCount = await this.moveDir(fromChild, toChild, overwrite)
												count += childCount
											} else if (stats.isSymbolicLink()) {
												if (await this.moveLink(fromChild, toChild, overwrite)) {
													count++
												}
											} else {
												if (await this.moveFile(fromChild, toChild, overwrite)) {
													count++
												}
											}
										} catch (e) {
											firstError = firstError || e
										}
										if (--pending < 1) {
											if (firstError) {
												reject(firstError)
											} else {
												this.deleteDir(src, false).then(() => {
													resolve(count)
												}, (error: NodeJS.ErrnoException) => {
													if (error.code === "ENOTEMPTY" || error.code === "EEXIST") {
														resolve(count)
													} else {
														reject(error)
													}
												})
											}
										}
									}
								})
							}
						} else {
							this.deleteDir(src, false).then(() => {
								resolve(0)
							}, reject)
						}
					}
				})
			}, reject)
		})
	}

	/**
	 * 移动指定的文件
	 * @param src 要移动的源路径
	 * @param dest 要移动的目标路径
	 * @param overwrite 是否允许覆盖现有的目标
	 * @returns 如果移动成功则返回 `true`，否则说明目标已存在，返回 `false`
	 */
	moveFile(src: string, dest: string, overwrite = true) {
		return new Promise<boolean>((resolve, reject) => {
			if (overwrite) {
				rename(src, dest, error => {
					if (error) {
						this.copyFile(src, dest).then(() => {
							this.deleteFile(src).then(() => {
								resolve(true)
							}, reject)
						}, reject)
					} else {
						resolve(true)
					}
				})
			} else {
				this.getStat(dest).then(() => {
					resolve(false)
				}, (error: NodeJS.ErrnoException) => {
					if (error.code === "ENOENT") {
						resolve(this.moveFile(src, dest, true))
					} else {
						reject(error)
					}
				})
			}
		})
	}

	/**
	 * 移动指定的链接
	 * @param src 要移动的源路径
	 * @param dest 要移动的目标路径
	 * @param overwrite 是否允许覆盖现有的目标
	 * @returns 如果移动成功则返回 `true`，否则说明目标已存在，返回 `false`
	 */
	async moveLink(src: string, dest: string, overwrite = true) {
		const result = await this.copyLink(src, dest, overwrite)
		if (result) {
			await this.deleteFile(src)
			return true
		}
		return false
	}

	/**
	 * 获取指定路径区分大小写的实际路径
	 * @param path 原路径
	 * @returns 如果路径存在则返回实际地址，如果地址不存在则返回空
	 */
	getRealPath(path: string) {
		return new Promise<string | null>((resolve, reject) => {
			safeCall(realpath.native, [path], (error, link) => {
				if (error) {
					if (error.code === "ENOENT") {
						resolve(null)
					} else {
						reject(error)
					}
				} else {
					resolve(link)
				}
			})
		})
	}

}

/** 表示遍历文件或文件夹的选项 */
export interface WalkOptions {

	/** 如果为 `true` 则链接被解析为实际的路径，否则不解析链接 */
	follow?: boolean

	/**
	 * 处理错误的回调函数
	 * @param error 出现的错误对象
	 * @param path 出现的错误路径
	 */
	error?(error: NodeJS.ErrnoException, path: string): void

	/**
	 * 处理一个文件的回调函数
	 * @param path 当前文件的路径
	 * @param stats 当前文件的属性对象
	 */
	file?(path: string, stats: Stats): void

	/**
	 * 处理一个文件夹的回调函数，如果函数返回 `false` 则跳过遍历此文件夹
	 * @param path 当前文件夹的路径
	 * @param stats 当前文件夹的属性对象
	 */
	dir?(path: string, stats: Stats): boolean | void

	/**
	 * 即将遍历指定的文件夹时的回调函数，如果函数返回 `false` 则跳过遍历此文件夹
	 * @param path 当前文件夹的路径
	 * @param entries 当前文件夹下的所有项
	 * @param stats 当前文件夹的属性对象
	 */
	scan?(path: string, entries: string[], stats: Stats): boolean | void

	/**
	 * 处理一个其它类型文件的回调函数
	 * @param path 当前文件的路径
	 * @param stats 当前文件的属性对象
	 */
	other?(path: string, stats: Stats): void

}

/** 安全调用系统 IO 函数，如果出现 EMFILE 错误则自动延时 */
function safeCall(func: DelayedCall["function"], args: DelayedCall["arguments"], callback: DelayedCall["callback"]) {
	func(...args, (error: NodeJS.ErrnoException, data: any) => {
		if (error) {
			switch (error.code) {
				case "EMFILE":
				case "ENFILE":
					delay({ function: func, arguments: args, callback })
					break
				case "EAGAIN":
					safeCall(func, args, callback)
					break
				default:
					resume()
					callback(error, data)
					break
			}
		} else {
			resume()
			callback(error, data)
		}
	})
}

/** 表示一个延时调用 */
interface DelayedCall {

	/** 调用的函数 */
	function: (...args: any[]) => void

	/** 调用的参数 */
	arguments: any[]

	/** 调用的回调函数 */
	callback: (error: NodeJS.ErrnoException, data: any) => void

	/** 下一个调用 */
	next?: DelayedCall

}

/** 一个已延时的调用链表尾 */
var delayedCallQueue: DelayedCall | undefined

/** 全局回调计时器 */
var delayedCallTimer: ReturnType<typeof setTimeout> | undefined

/** 延时执行指定的调用 */
function delay(delayedCall: DelayedCall) {
	// 为节约内存，所有延时调用使用单链表保存
	if (delayedCallQueue) {
		delayedCall.next = delayedCallQueue.next
		delayedCallQueue = delayedCallQueue.next = delayedCall
	} else {
		delayedCallQueue = delayedCall.next = delayedCall
	}
	// 假设系统允许最多同时打开 1000 个文件句柄，那么第 1001 次会触发 EMFILE 错误，这次调用会被延时
	// 如果前 1000 次都是由 `safeCall` 发起的，那么在每次句柄释放后都会主动调用 `resume` 执行延时的操作
	// 但如果前 1000 次是用户直接调用（比如通过 `fs.read`）的，那么 `resume` 就永远不会被调用，即使句柄已经释放了
	// 为确保 `resume` 函数被执行，等待几秒后自动重试
	if (!delayedCallTimer) {
		delayedCallTimer = setTimeout(resume, 3000)
	}
}

/** 恢复执行一个已延时的调用 */
function resume() {
	if (delayedCallQueue) {
		const head = delayedCallQueue.next!
		if (head === delayedCallQueue) {
			delayedCallQueue = undefined
		} else {
			delayedCallQueue.next = head.next
		}
		safeCall(head.function, head.arguments, head.callback)
		// 如果所有延时操作都已执行完成，则删除计时器
		if (!delayedCallQueue && delayedCallTimer) {
			clearTimeout(delayedCallTimer)
			delayedCallTimer = undefined
		}
	}
}