import { Stats } from "fs"
import { color, ConsoleColor } from "../utils/ansi"
import { containsPath, getDir } from "../utils/path"
import { Watcher as FSWatcher } from "../utils/watcher"
import { Builder } from "./builder"
import { i18n } from "./i18n"

/** 表示一个文件监听器 */
export class Watcher extends FSWatcher {

	/** 获取所属的构建器 */
	readonly builder: Builder

	/**
	 * 初始化新的开发服务器
	 * @param builder 所属的构建器对象
	 * @param options 监听器的附加选项
	 */
	constructor(builder: Builder, options?: WatcherOptions) {
		super()
		this.builder = builder
		if (options) {
			if (options.usePolling) {
				this.usePolling = true
			}
			if (options.delay != undefined) {
				this.delay = options.delay
			}
			if (options.interval) {
				this.watchOptions.interval = options.interval
			}
		}
	}

	/** 
	 * 启用监听器
	 * @param callback 开始监听的回调函数
	 */
	start(callback?: (error: NodeJS.ErrnoException | null, path: string) => void) {
		super.add(this.builder.rootDir, callback)
	}

	add(path: string, callback?: (error: NodeJS.ErrnoException | null, path: string) => void) {
		// 根目录已监听
		if (containsPath(this.builder.rootDir, path)) {
			callback && callback(null, path)
			return
		}
		super.add(this.usePolling ? path : getDir(path), callback)
	}

	remove(path: string) {
		// 不能移除根目录
		if (containsPath(this.builder.rootDir, path)) {
			return
		}
		super.remove(this.usePolling ? path : getDir(path))
	}

	protected onChange(path: string, stats: Stats, lastWriteTime: number) {
		this.builder.logger.info(`${color(i18n`Changed`, ConsoleColor.brightCyan)} ${this.builder.logger.formatPath(path)}`)
		super.onChange(path, stats, lastWriteTime)
		this.builder.commitChange(path)
	}

	protected onCreate(path: string, stats: Stats) {
		this.builder.logger.info(`${color(i18n`Created`, ConsoleColor.brightMagenta)} ${this.builder.logger.formatPath(path)}`)
		super.onCreate(path, stats)
		this.builder.commitCreate(path)
	}

	protected onDelete(path: string, lastWriteTime: number) {
		this.builder.logger.info(`${color(i18n`Deleted`, ConsoleColor.brightYellow)} ${this.builder.logger.formatPath(path)}`)
		super.onDelete(path, lastWriteTime)
		this.builder.commitDelete(path)
	}

	protected onError(e: NodeJS.ErrnoException, path: string) {
		this.builder.logger.error({ fileName: path, error: e })
		super.onError(e, path)
	}

}

/** 表示监听器的选项 */
export interface WatcherOptions {
	/**
	 * 监听延时回调的毫秒数
	 * @default false
	 */
	usePolling?: boolean
	/**
	 * 轮询的间隔毫秒数
	 * @default 500
	 */
	interval?: number
	/**
	 * 轮询的间隔毫秒数
	 * @default 151
	 */
	delay?: number
}