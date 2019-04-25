# Less 插件
支持在项目里使用 [Less](http://lesscss.org/usage/index.html) 语法编写 CSS。

## 安装
此插件已内置，无需安装。
如果项目里出现 `.less` 文件，TPack 会自动安装 Less 编译器。

或者你也可以手动安装 Less 编译器：`npm install less --save-dev`。

## 配置
```js
export default {
	compilers: [
		{
			match: "*.less",
			use: "tpack/compilers/less",
			options: { /* 可选的附加选项，详见下文 */ }
		}
	]
}
```

### 附加选项
```js
{
	functions: {},              // 供 Less 调用的自定义函数
	globalVars: {},             // 供 Less 使用的全局变量（如 { var1: '"string value"'}，然后在 less 里使用 @var1）
	modifyVars: {},             // 覆盖 Less 定义的全局变量（如 { var1: '"string value"'}，然后在 less 里使用 @var1）
	paths: [],                  // 解析 @import 的全局搜索目录，如 ["src/components"]，默认为 ["<项目根目录>"]
	rewriteUrls: "all",         // 重写 url() 中的地址（"all": 全部重写，"local"：仅重写 ./ 开头的路径，"off"：全部不重写）

	env: "development",         // 生成环境（"development": 开发环境；"production"：生产环境）
	logLevel: 2,                // 日志等级（0：不打印日志；1：仅打印错误；2：打印错误和信息）
	poll: 1000,                 // 监听模式下的轮询等待毫秒数
	dumpLineNumbers: null,      // 是否输出行号（"comments"：生成包含行号信息的注释）
	rootpath: null,             // 最终引用 CSS 的根地址（如 "http://cdn.example.com/"）
	useFileCache: true,         // 是否允许缓存已解析的文件
	errorReporting: "console",  // 报告错误的方式（"console"：在控制台打印）

	// 以下选项已在插件内部设置，不建议用户修改
	async: false,               // 是否异步加载文件
	sourceMap: true,            // 是否生成源映射
	filename: "",               // 源文件名，用于解析相对路径
	syncImport: true,           // 是否同步载入导入文件
	compress: false,            // 是否压缩代码
	fileAsync: false,           // 是否异步加载文件
}
```
完整最新的配置请参考: [官方文档](http://lesscss.org/usage/index.html)。

## 使用
可以在原来需要 CSS 的地方直接改成 Less 文件，
打包后 `.less` 扩展名会被替换为 `.css`。

比如在 HTML 导入：
```html
<link rel="stylesheet" href="./common.less">
```

或在 JS 导入：
```js
import "./common.less"
```