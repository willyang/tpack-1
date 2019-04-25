# Stylus 插件
支持在项目里使用 [Stylus](http://stylus-lang.com/) 语法编写 CSS。

## 安装
此插件已内置，无需安装。
如果项目里出现 `.styl` 文件，TPack 会自动安装 Stylus 编译器。

或者你也可以手动安装 Stylus 编译器：`npm install stylus --save-dev`。

## 配置
```js
export default {
	compilers: [
		{
			match: "*.styl",
			use: "tpack/compilers/stylus",
			options: { /* 可选的附加选项，详见下文 */ }
		}
	]
}
```

### 附加选项
```js
{
	functions: {},              // 供 Stylus 调用的自定义函数
	globals: {},                // 供 Stylus 使用的全局变量（如 { var1: '"string value"'}，然后在 stylus 里使用 var1）
	imports: [],                // 全局导入的 Stylus 路径
	paths: [],                  // 解析 @import 的全局搜索目录，如 ["src/components"]，默认为 ["<项目根目录>"]
	use: [],                    // 附加使用的插件

	// 以下选项已在插件内部设置，不建议用户修改
	sourcemap: {                // 是否生成源映射
		comment: false,         // 是否添加 #sourceMappingURL 注释，官方默认 `true`，插件已设置为 `false`
		inline: false,          // 是否内联源映射
		sourceRoot: "",         // 源映射中的 sourceRoot
		basePath: '.',          // 源映射中使用的根路径
	}
	filename: "",               // 源文件名，用于解析相对路径
}
```
完整最新的配置请参考: [官方文档](http://stylus-lang.com/docs/js.html)。

## 使用
可以在原来需要 CSS 的地方直接改成 Stylus 文件，
打包后 `.styl` 扩展名会被替换为 `.css`。

比如在 HTML 导入：
```html
<link rel="stylesheet" href="./common.styl">
```

或在 JS 导入：
```js
import "./common.styl"
```