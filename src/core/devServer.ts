/** 表示一个开发服务器的选项 */
export interface DevServerOptions {
	url?: string
	/** 
	 * 设置服务器的根路径，其中 "~" 表示所有项目文件的根文件夹
	 * @default ["~"]
	 */
	rootDir?: string | string[]
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