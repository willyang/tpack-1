import { Builder } from "./builder"
import { Watcher as FSWatcher } from "../utils/watcher"
import { Stats } from "fs"
import { color, ConsoleColor } from "../utils/ansi"
import { formatDate } from "../utils/misc"
import { i18n } from "./i18n"
import { containsPath, getDir } from "../utils/path"

/** 表示一个文件监听器 */
export class Watcher extends FSWatcher {

	/** 获取所属的构建器 */
	readonly builder: Builder

	/** 判断是否延迟构建 */
	readonly lazyBuild: boolean

	/**
	 * 初始化新的开发服务器
	 * @param builder 所属的构建器对象
	 * @param options 监听器的附加选项
	 */
	constructor(builder: Builder, options?: WatcherOptions) {
		super()
		this.builder = builder
		this.lazyBuild = !!(options && options.lazyBuild)
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

	/** 启用监听器 */
	start(callback?: (error: NodeJS.ErrnoException | null, path: string) => void) {
		super.add(this.builder.rootDir, callback)
	}

	add(path: string, callback?: (error: NodeJS.ErrnoException | null, path: string) => void) {
		// 根目录已监听
		if (containsPath(this.builder.rootDir, path)) {
			callback && callback(null, path)
			return
		}
		super.add(getDir(path), callback)
	}

	remove(path: string) {
		// 不能移除根目录
		if (containsPath(this.builder.rootDir, path)) {
			return
		}
		super.remove(getDir(path))
	}

	protected async onChange(path: string, stats: Stats, lastWriteTime: number) {
		this.builder.logger.log(`${color(formatDate(new Date(), "[HH:mm:ss]"), ConsoleColor.brightBlack)} ${color(i18n`[Changed]`, ConsoleColor.brightCyan)} ${this.builder.logger.formatPath(path)}`)
		super.onChange(path, stats, lastWriteTime)
		const count = await this.builder.commitChange(path)
		if (count > 0 && !this.lazyBuild) {
			await this.builder.build()
		}
	}

	protected async onCreate(path: string, stats: Stats) {
		this.builder.logger.log(`${color(formatDate(new Date(), "[HH:mm:ss]"), ConsoleColor.brightBlack)} ${color(i18n`[Created]`, ConsoleColor.brightMagenta)} ${this.builder.logger.formatPath(path)}`)
		super.onCreate(path, stats)
		const count = await this.builder.commitChange(path)
		if (count > 0 && !this.lazyBuild) {
			await this.builder.build()
		}
	}

	protected async onDelete(path: string, lastWriteTime: number) {
		this.builder.logger.log(`${color(formatDate(new Date(), "[HH:mm:ss]"), ConsoleColor.brightBlack)} ${color(i18n`[Deleted]`, ConsoleColor.brightYellow)} ${this.builder.logger.formatPath(path)}`)
		super.onDelete(path, lastWriteTime)
		const count = await this.builder.commitDelete(path)
		if (count > 0 && !this.lazyBuild) {
			await this.builder.build()
		}
	}

	protected onError(e: NodeJS.ErrnoException, path: string) {
		super.onError(e, path)
		this.builder.logger.error({ fileName: path, error: e })
	}

}

/** 表示监听器的选项 */
export interface WatcherOptions {
	/**
	 * 是否延迟构建
	 * @default false
	 */
	lazyBuild?: boolean
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