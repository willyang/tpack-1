# CSS 压缩插件
使用 [CleanCSS](https://github.com/jakubpawlowicz/clean-css) 压缩优化 CSS。

## 安装
此插件已内置，无需安装。
启用优化时，如果项目里存在 `.css` 文件，TPack 会自动安装 CleanCSS 并压缩 CSS。

或者你也可以手动安装 CleanCSS：`npm install clean-css --save-dev`。

## 配置
```js
export default {
	optimizers: [
		{
			match: ["*.css", "!*.min.css"],
			use: "tpack/optimizers/css",
			options: { /* 可选的附加选项，详见下文 */ }
		}
	]
}
```

### 附加选项
```js
{
	compatibility: "ie10+",         // 兼容性列表（"*"(默认，同 ie10+)、"ie7"、"ie8"、"ie9"），详见：https://github.com/jakubpawlowicz/clean-css#how-to-set-a-compatibility-mode
	fetch: null,                    // 自定义如何导入外部文件（(uri, inlineRequest, inlineTimeout, callback) => void），详见：https://github.com/jakubpawlowicz/clean-css#fetch-option
	format: false,                  // 输出格式（false(默认)/"beautify"/"keep-breaks"），详见：https://github.com/jakubpawlowicz/clean-css#formatting-options
	inline: false,                  // 是否内联 @import（false(默认)/["local"]/["none"]/["all"]/["local", "mydomain.example.com"]），详见：https://github.com/jakubpawlowicz/clean-css#inlining-options
	inlineRequest: null,            // 导入远程文件时的 HTTP(S) 请求附加参数
	inlineTimeout: 5000,            // 导入远程文件时的请求超时（单位：毫秒）
	level: 1,                       // 压缩的等级（0: 不压缩；1: 无副作用压缩(默认)；2: 可能含副作用压缩），详见：https://github.com/jakubpawlowicz/clean-css#optimization-levels
	rebase: false,                  // 是否重定位引用地址
	rebaseTo: process.cwd(),        // 重定位引用时使用的根地址

	// 以下选项已在插件内部设置，不建议用户修改
	sourceMap: false,               // 否生成源映射
	sourceMapInlineSources: false,  // 是否在源映射中内联源
	returnPromise: false,           // 是否返回 Promise 对象
}
```
完整最新的配置请参考: [官方文档](https://github.com/jakubpawlowicz/clean-css#constructor-options)。

## 使用
使用 `tpack -p` 或在配置中添加 `{optimize: true}` 启用压缩。

所有 CSS 文件，包括由 Less、Sass 等编译生成的 CSS，从 JS 模块导出的 CSS，HTML 内联的样式都会被压缩。

如果希望排除 HTML 内联的样式，可以在匹配的规则添加 `!*|*.css`。