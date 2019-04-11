import { encode as encodeHTML } from "ent"
import { createServer, IncomingMessage, Server, ServerResponse, STATUS_CODES } from "http"
import { AddressInfo } from "net"
import { join } from "path"
import { parse } from "url"
import { bold, color, ConsoleColor } from "../utils/ansi"
import { formatDate } from "../utils/misc"
import { open } from "../utils/process"
import { Builder } from "./builder"
import { i18n } from "./i18n"
import { Module, ModuleState } from "./module"

/** 表示一个开发服务器 */
export class DevServer {

	// #region 服务器

	/** 获取所属的构建器 */
	readonly builder: Builder

	/** 获取内部使用的 HTTP 服务器对象 */
	readonly httpServer: Server

	/** 获取服务器的模式 */
	readonly mode: DevServerMode

	/** 是否在首次启动时打开浏览器 */
	readonly open: boolean | string

	/** 判断当前开发服务器正在运行 */
	get running() { return this.httpServer.listening }

	/**
	 * 初始化新的开发服务器
	 * @param builder 所属的构建器
	 * @param options 服务器的附加选项
	 */
	constructor(builder: Builder, options: DevServerOptions = {}) {
		this.builder = builder
		this.httpServer = createServer(this._processRequest)
		// @ts-ignore
		this.mode = options.mode !== undefined ? typeof options.mode === "string" ? DevServerMode[options.mode] : options.mode : DevServerMode.idle
		this.open = options.open || false
		if (options.url != undefined) {
			if (typeof options.url === "string") {
				const { hostname, port, pathname } = parse(options.url)
				if (hostname) {
					this.hostname = hostname
				}
				if (port) {
					this.port = parseInt(port) || undefined
				}
				if (pathname) {
					this.rootPath = pathname
				}
			} else {
				this.port = options.url
			}
		}
		if (this.port == undefined) this.port = 8000 + hashCode(builder.baseDir) % 1000

		/** 快速计算字符串标识 */
		function hashCode(value: string) {
			let count = 0
			for (let i = 0; i < value.length; i++) {
				count += value.charCodeAt(i)
			}
			return count
		}
	}

	/** 获取配置的服务器地址 */
	readonly hostname?: string

	/** 获取配置的服务器端口 */
	readonly port?: number

	/** 最大允许的连接数 */
	readonly backlog?: number

	/** 获取服务根地址 */
	readonly rootPath: string = "/"

	/**
	 * 启动服务器
	 * @param backlog 最大允许的连接数
	 */
	start() {
		return new Promise<void>((resolve, reject) => {
			this.httpServer.on("error", startError)
			this.httpServer.listen(this.port, this.hostname, this.backlog, () => {
				this.httpServer.off("error", startError)
				this.builder.logger.info(i18n`${color(formatDate(new Date(), "[HH:mm:ss]"), ConsoleColor.brightBlack)} ${color(i18n`Started`, ConsoleColor.brightCyan)} Server running at ${bold(this.url!)}`)
				if (this.open) {
					open(this.url!, false, typeof this.open === "string" ? this.open : undefined)
				}
				resolve()
			})

			function startError(e: any) {
				if (e.code === "EADDRINUSE") {
					reject(i18n`Cannot start server: Port ${e.port} is used by other program. (Have you started a server before?)`)
				} else {
					reject(i18n`Cannot start server: ${e.stack}`)
				}
			}
		})
	}

	/** 获取当前服务器的根地址，如果服务器未启动则返回 `undefined` */
	get url() {
		const addr = this.httpServer.address() as AddressInfo | null
		if (!addr) {
			return undefined
		}
		return `http://${addr.address.startsWith("::") || addr.address === "0.0.0.0" ? "localhost" : addr.address}${addr.port === 80 ? "" : ":" + addr.port}${this.rootPath === "/" ? "" : this.rootPath}`
	}

	/**
	 * 关闭服务器
	 */
	close() {
		return new Promise<void>((resolve, reject) => {
			this.httpServer.close(error => {
				if (error) {
					reject(error)
				} else {
					this.builder.logger.info(i18n`${color(i18n`Stopped`, ConsoleColor.brightYellow)} Server stopped`)
					resolve()
				}
			})
		})
	}

	/** 处理客户端请求 */
	private _processRequest = async (req: IncomingMessage, res: ServerResponse) => {
		let { pathname, query } = parse(req.url!)
		const outPath = join(this.builder.outDir, decodeURIComponent(pathname!))
		try {
			const module = await this.builder.getEmittedModule(outPath)
			if (module) {
				return this._handleModule(req, res, module)
			}
		} catch (e) {
			return this._handleError(req, res, e)
		}
		return this._handleError(req, res, { code: "ENOENT" })
	}

	/**
	 * 处理一个模块
	 * @param req 当前的请求对象
	 * @param res 当前的响应对象
	 * @param module 要处理的模块
	 */
	private _handleModule(req: IncomingMessage, res: ServerResponse, module: Module) {
		if (module.state !== ModuleState.emitted) {
			res.writeHead(500, {
				'Content-Type': module.type || this.builder.getMimeType(module.ext)
			})
			return res.end(module.data)
		}
		const ifNoneMatch = +req.headers["if-none-match"]!
		if (ifNoneMatch === module.emitTime) {
			res.writeHead(304)
			return res.end()
		}
		res.writeHead(200, {
			'Content-Type': module.type,
			'ETag': module.emitTime
		})
		res.end(module.data)
	}

	/**
	 * 处理一个错误
	 * @param req 当前的请求对象
	 * @param res 当前的响应对象
	 * @param error 要处理的错误
	 */
	private _handleError(req: IncomingMessage, res: ServerResponse, error: any) {
		const statusCode = error.code === 'ENOENT' ? 404 : error.code === 'EACCESS' ? 403 : 500
		const { pathname } = parse(req.url!)
		res.writeHead(statusCode, {
			'Content-Type': 'text/html'
		})
		res.end(`<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>${statusCode}: ${encodeHTML(pathname!)}</title>
</head>
<body>
	<pre>${statusCode} - ${STATUS_CODES[statusCode]}: ${encodeHTML(statusCode < 500 ? pathname : error.stack)}</pre>
</body>
</html>`)
		if (statusCode >= 500) {
			this.builder.logger.error(error)
		}
	}

}

/** 表示开发服务器的选项 */
export interface DevServerOptions {
	/**
	 * 开发服务器的地址或端口
	 * @description
	 * 如果设置为 IP 地址(`"localhost"` 等价于 `"127.0.0.1"`)，则只能使用对应 IP 访问服务
	 * > 如果你需要在电脑打开服务，然后通过手机访问服务，应设置为 `"0.0.0.0"`（默认），然后将 node 程序加入网络防火墙白名单
	 * 端口默认为 8xxx，其中 xxx 由项目名决定，这样同一个项目的端口是固定的，但不同的项目使用不同的端口
	 * @default "0.0.0.0:0"
	 */
	url?: string | number
	/** 最大允许的连接数 */
	backlog?: number
	/** 
	 * 服务器的编译模式
	 * - "normal"：先编译项目，然后启动服务器，文件更新后立即重新编译（比较慢）
	 * - "idle"（默认）: 立即启动服务器，并利用空闲时间自动编译
	 * - "fast": 立即启动服务器，当通过服务器请求文件时再编译文件（快）
	 */
	mode?: keyof typeof DevServerMode | DevServerMode
	/** 是否在首次启动时打开浏览器 */
	open?: boolean | string

	// /** 
	//  * 设置服务器的根路径，其中 "~" 表示所有项目文件的根文件夹
	//  * @default ["~"]
	//  */
	// rootDir?: string | string[]
	// /** 
	//  * 设置是否在文件修改后自动刷新页面
	//  * @default true
	//  */
	// autoReload?: boolean
	// /** 
	//  * 设置是否启用模块热替换
	//  * @default true
	//  */
	// hotReload?: boolean
	// /** 
	//  * 设置开发服务器默认首页
	//  * @default ["index.html"]
	//  */
	// defaultPages?: string[]
	// /** 
	//  * 设置是否自动列出文件，如果是字符串则表示使用自定义的列出规则
	//  * @default true
	//  */
	// directoryList?: boolean | string | (() => void)
}
/** 表示服务器的模式 */
export const enum DevServerMode {
	/** 普通模式，文件更新后立即重新构建 */
	normal,
	/** 空闲模式，利用空闲时间构建 */
	idle,
	/** 快启模式，仅在请求文件时构建 */
	fast,
}