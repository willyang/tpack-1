# Sass 插件
支持在项目里使用 [Sass](https://github.com/sass/node-sass) 语法编写 CSS。

## 安装
此插件已内置，无需安装。
如果项目里出现 `.scss` 或 `.sass` 文件，TPack 会自动安装 Sass 编译器。

或者你也可以手动安装 Sass 编译器：`npm install node-sass --save-dev`。

> 友情提示：中国大陆地区使用 `npm` 可能无法成功安装 `node-sass`
> ##### 解决方案一：使用镜像
> `npm install -g mirror-config-china --registry=http://registry.npm.taobao.org`
>
> `npm install node-sass --save-dev`
> ##### 解决方案二：使用 cnpm
> `npm install -g cnpm --registry=http://registry.npm.taobao.org`
>
> `cnpm install node-sass --save-dev`
>
> 如果希望 TPack 自动安装命令默认使用 cnpm，添加如下配置：
> `export default { installCommand: "cnpm i <modules>" }`
> ##### 解决方案三：[查看官方文档](https://github.com/sass/node-sass/blob/master/TROUBLESHOOTING.md)

## 配置
```js
export default {
	compilers: [
		{
			match: "*.{scss,sass}",
			use: "tpack/compilers/sass",
			options: { /* 可选的附加选项，详见下文 */ }
		}
	]
}
```

### 附加选项
```js
{
	functions: {},              // 供 Sass 调用的自定义函数
	includePaths: [],           // 解析 @import 的全局搜索目录，如 ["src/components"]，默认为 ["<项目根目录>"]
	importer: undefined,        // 自定义解析 @import 地址的函数（(url: string, prev: string, done: (file: string, contents: string) => void) => string）

	precision: 5,               // 设置计算得到的小数保留的小数位数，超过的部分将四舍五入
	sourceComments: false,      // 保留源码中的注释
	outputStyle: "expanded",    // 生成的 CSS 代码风格（"nested": 紧挨；"expanded": 展开；"compact": 紧凑；"compressed": 压缩）
	indentType: "tab",	        // 缩进字符，可以是 "tab" 或 "space"
	indentWidth: 2,             // 缩进字符的个数
	linefeed: "cr",    	        // 换行符，可以是 "cr"、"lf"、"crlf" 或 "lfcr"
	outFile: null,              // 生成文件的路径
	
	// 以下选项已在插件内部设置，不建议用户修改
	indentedSyntax: false,      // 使用 Lisp 风格的缩进语法
	omitSourceMapUrl: true,     // 如果为 true 则不在文件末位追加 #SourceMappingURL
	sourceMap: false,           // 是否生成源映射
	sourceMapContents: false,   // 是否在源映射中包含源码
	sourceMapEmbed: false,      // 是否在源码中包含源映射
	sourceMapRoot: undefined,   // 源映射中的根路径
}
```
完整最新的配置请参考: [官方文档](https://github.com/sass/node-sass)。

## 使用
可以在原来需要 CSS 的地方直接改成 Sass 文件，
打包后 `.sass` 扩展名会被替换为 `.css`。

比如在 HTML 导入：
```html
<link rel="stylesheet" href="./common.sass">
```

或在 JS 导入：
```js
import "./common.sass"
```

> ##### 注意：不要在导入的 Sass 文件中使用相对路径
> Sass 暂未支持重写 CSS 中的相对地址，导入的 Sass 文件中相对路径只能原样输出，详见[Github](http://github.com/sass/sass/issues/2535)