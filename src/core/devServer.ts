import { Server, createServer, IncomingMessage, ServerResponse } from "http"
import { AddressInfo } from "net"
import { parse } from "url"
import { Builder } from "./builder"
import { resolvePath } from "../utils/path"

/** 表示一个开发服务器 */
export class DevServer {

	// #region 服务器

	/** 获取所属的构建器 */
	readonly builder: Builder

	/**
	 * 初始化新的开发服务器
	 * @param builder 所属的构建器
	 */
	constructor(builder: Builder) {
		this.builder = builder
	}

	/** 底层服务器对象 */
	private _httpServer?: Server

	/** 获取或设置服务根地址 */
	rootPath = "/"

	/** 获取当前服务器的根地址，如果服务器未启动则返回 `undefined` */
	get url() {
		if (this._httpServer) {
			const { address, port } = this._httpServer.address() as AddressInfo
			return `http://${address.startsWith("::") || address === "0.0.0.0" ? "localhost" : address}${port === 80 ? "" : ":" + port}${this.rootPath === "/" ? "" : this.rootPath}`
		}
	}

	/**
	 * 启动服务器
	 * @param url 要监听的地址或端口
	 * @param backlog 最大允许的连接数
	 */
	start(url: string | number = 80, backlog?: number): Promise<void> {
		if (this._httpServer) {
			return this.close().then(() => this.start(url, backlog))
		}
		return new Promise<void>((resolve, reject) => {
			const server = this._httpServer = createServer(this._processRequest)
			server.on("close", () => {
				this._httpServer = undefined
			})
			server.on("error", reject)
			if (typeof url === "string") {
				const { hostname, port, pathname } = parse(url)
				if (pathname) {
					this.rootPath = pathname
				}
				return server.listen(+port! || 80, hostname, backlog)
			}
			return server.listen(url, backlog, resolve)
		})
	}

    /**
     * 关闭服务器
     */
	close() {
		return new Promise<void>((resolve, reject) => {
			if (this._httpServer) {
				this._httpServer.close((error: Error) => {
					if (error) {
						reject(error)
					} else {
						resolve()
					}
				})
			} else {
				resolve()
			}
		})
	}

	/** 处理客户端请求 */
	private _processRequest = (req: IncomingMessage, res: ServerResponse) => {
		res.end("hello  world")
	}

	// #endregion

	// #region 构建


	// #endregion

}


/** 表示一个开发服务器的选项 */
export interface DevServerOptions {

	url?: string

	/** 
	 * 设置服务器的根路径，其中 "~" 表示所有项目文件的根文件夹
	 * @default ["~"]
	 */
	rootDir?: string | string[],

	/** 
	 * 设置开发服务器的主机地址
	 * @default "0.0.0.0"
	 * @desc 如果设置为 IP 地址(`"localhost"` 等价于 `"127.0.0.1"`)，则只能使用对应 IP 访问服务
	 * > 如果你需要在电脑打开服务，然后通过手机访问服务，需要设置为 `"0.0.0.0"`（默认），然后将 node 程序加入网络防火墙白名单
	 */
	host?: string

	/** 
	 * 设置开发服务器的端口
	 * @default 8086
	 */
	port?: number

	/** 
	 * 设置是否在文件修改后自动刷新页面
	 * @default true
	 */
	autoReload?: boolean

	/** 
	 * 设置是否启用模块热替换
	 * @default true
	 */
	hotReload?: boolean

	/** 
	 * 设置开发服务器默认首页
	 * @default ["index.html"]
	 */
	defaultPages?: string[]

	/** 
	 * 设置是否自动列出文件，如果是字符串则表示使用自定义的列出规则
	 * @default true
	 */
	directoryList?: boolean | string | (() => void)

	/** 是否在首次启动时打开浏览器 */
	open?: boolean | string

}