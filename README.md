# TPack 3 - 一个开箱即用的多页极速打包工具
[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]
[![Build Status][travis-image]][travis-url]
[![Coveralls Status][coveralls-image]][coveralls-url]
[![Gitter chat][gitter-image]][gitter-url]

打包 Web 项目中的任意资源文件，既可零配置启动，又可插件化灵活配置，更适于多页应用。

## 特性

### 1. 一切都是入口！专为多页场景设计
- 打包从 `src` 到 `dist` 文件夹，任何格式都可依赖分析
- 以 HTML 为入口，更适合活动推广页、组件库和多页 WebAPP

### 2. 零配置秒启
- 零配置启动现有项目：自动打包、支持热更新（HMR, Hot Module Replacement）
- 开发服务秒开，项目再大也不卡

### 3. 可深度定制，配置简单
- 插件化打包配置；内置 JSX/TS/Less/Sass/Stylus 等热门插件
- 可扩展自定义命令，集成所有开发服务，比如生成模拟（Mock）数据

### 4. 更多现代项目所需功能
- [公共模块拆分（Common Chunk Split）](https://github.com/tpack/tpack/wiki/公共模块拆分)
- [导出优化（Tree Shaking + Scope Hoisting）](https://github.com/tpack/tpack/wiki/导出优化)
- [组件 API 文档自动生成](https://github.com/tpack/tpack/wiki/API-文档生成)
- [自动化测试](https://github.com/tpack/tpack/wiki/自动化测试)

## 快速上手

### 安装
```bash
npm install tpack -g
```
> 如果不会安装或安装失败，[请点击这里](https://github.com/tpack/tpack/wiki/常见问题#安装失败)

### 启动
在项目根目录新建 `index.html`：
```html
<html>
<body>
	<div id="root"></div>
    <script>
        import React from "react"
        import ReactDOM from "react-dom"

        ReactDOM.render(<h1>Hello, world!</h1>, document.getElementById("root"))
    </script>
</body>
</html>
```

无需配置，直接执行以下命令即可启动本地服务：
```bash
tpack -s 8086
```

> 如果启动失败，[请点击这里](https://github.com/tpack/tpack/wiki/常见问题#启动失败)

然后在浏览器打开 http://localhost:8086/index.html, TPack 会自动为你安装依赖并编译代码。

在 HTML 中引入 JavaScript、CSS 和图片；
在 JavaScript 中使用 ES6 `import` 引入更多的模块；
在 CSS 中使用 `@import` 引入更多的 CSS 和图片
——TPack 都会跟随着依赖去构建整个项目。

### 发布
开发完成后，执行以下命令即可压缩、优化代码并生成 `dist` 目录，用于发布上线：
```bash
tpack -p
```

## 配置
使用命令行时，TPack 会自动搜索项目根目录的 `tpack.config.js` 作为配置文件，默认配置如下：
```js
export default {
	rootDir: "src", // 需要把 src 下的所有入口文件都打包到 dist
	outDir: "dist", // 生成到 dist
	exclude: "./src/components/**", // 排除 src/components 作为入口，组件只有在被依赖时才会打包

	compilers: [ // 所有文件（包括 node_modules）都会按顺序依次执行编译器
		{ match: "src/static/**", break: true }, // src/static 不作任何编译直接复制到 dist

		{ match: "*.less", use: "tpack/compilers/less" }, // 编译 less
		{ match: "*.{sass,scss}", use: "tpack/compilers/sass" }, // 编译 sass
		{ match: "*.styl", use: "tpack/compilers/stylus" }, // 编译 stylus

		{ match: ["*.{js,jsx}", "!**/node_modules/**"], use: "tpack/compilers/typescript" }, // 编译 jsx
		{ match: ["*.{ts,tsx}", "!*.d.ts"], use: "tpack/compilers/typescript" }, // 编译 typescript

		{ match: "*.vue", use: "tpack/compilers/vue" }, // 编译 vue
		{ match: "*.svg", use: "tpack/compilers/svg" }, // 编译 svg 图标
	],

	bundler: { // 配置怎么打包依赖
		resolver: { // 配置怎么解析 import "react" 中的路径
			modules: ["./src/components", "node_modules"] // import "button" 时，"button" 从 src/components 和 node_modules 搜索
		},
		externalModules: [ // node_modules 的外部资源需要拷贝到项目里，或者内联
			{ match: "*.{png,jpg,gif,svg,wbmp,bmp,ico,jpe,jpeg,cur,webp,jfif}", minSize: 2048, outPath: "assets/images/<path>" },
			{ match: "*.{eot,ttf,tif,tiff,woff,woff2}", minSize: 2048, outPath: "assets/fonts/<path>" },
			{ match: "*.{mp3,ogg,wav,aac,mid}", minSize: 2048, outPath: "assets/audios/<path>" },
			{ match: "*.{mp4,webm,mpg,mpeg,avi,3gpp,flv}", minSize: 2048, outPath: "assets/videos/<path>" },
			{ minSize: 2048, outPath: "assets/resources/<path>" }
		],
		
		js: {
			commonModules: [ // JS 公共模块拆分
				{ match: "**/node_modules", outPath: "assets/vendors.<name>.js", minSize: 10240, maxSize: 1024000, maxInitialRequests: 3, maxAsyncRequests: 5 },
				{ outPath: "assets/commons.<name>.js", minSize: 10240, maxSize: 1024000, maxInitialRequests: 3, maxAsyncRequests: 5 },
			],
			extractCSSModules: true, // 单独提取 JS 关联的 CSS 文件
			treeShaking: true, // 启用 Tree Shaking
			scopeHoisting: true // 启用 Scope Hoisting
		},
		css: {
			import: true // 打包 @import
		},
		html: {
			include: true, // 打包 <!-- #include -->
			js: "tsx", // JS 代码默认语言
			css: "less" // CSS 代码默认语言
		},

		output: { // 最终输出相关的配置
			publicURL: "/", // CDN 服务器路径
		}
	},

	optimize: false,
	optimizers: [ // 如果 tpack -p 或 optimize 为 true，则额外执行以下优化器
		{ match: ["*.js", "!*.min.js"], use: "tpack/optimizers/js" }, // 压缩 js
		{ match: ["*.css", "!**/node_modules/**"], use: "tpack/compilers/autoprefixer" }, // css 自动添加后缀
		{ match: ["*.css", "!*.min.css"], use: "tpack/optimizers/css" }, // 压缩 css
		{ match: "assets/**", outPath: "assets/<dir>/<name>.<md5><ext>" } // 添加后缀
	],

	sourceMap: true, // 生成 Source Map，方便调试
	clean: true, // 构建前先清理 dist
	devServer: "http://0.0.0.0:8000", // 启动开发服务器
	installCommand: "npm install <module> --colors" // 用于自动安装模块的命令，设为 false 可禁用自动下载
}
```
[查看完整配置文档](https://github.com/tpack/tpack/wiki/配置)

## 文档
- [命令行](http://github.com/tpack/tpack/wiki/命令行)
- [配置](https://github.com/tpack/tpack/wiki/配置)
- [API](http://github.com/tpack/tpack/wiki/api)

## 插件

### JS
- [Babel](https://github.com/tpack/tpack/wiki/Babel)
- [TypeScript](https://github.com/tpack/tpack/wiki/TypeScript)
- [CoffeeScript](https://github.com/tpack/tpack/wiki/CoffeeScript)

### CSS
- [Less](https://github.com/tpack/tpack/wiki/Less)
- [Sass](https://github.com/tpack/tpack/wiki/Sass)
- [Stylus](https://github.com/tpack/tpack/wiki/Stylus)
- [PostCSS](https://github.com/tpack/tpack/wiki/PostCSS)
- [Autoprefixer](https://github.com/tpack/tpack/wiki/Autoprefixer)

### 模板
- [Vue](https://github.com/tpack/tpack/wiki/Vue)

### 压缩
- [UglifyJS](https://github.com/tpack/tpack/wiki/UglifyJS)
- [CleanCSS](https://github.com/tpack/tpack/wiki/CleanCSS)
- [HTMLMinify](https://github.com/tpack/tpack/wiki/HTMLMinify)

### 其它
- [Gulp 插件](https://github.com/tpack/tpack/wiki/Gulp-插件)
- [Webpack-loader](https://github.com/tpack/tpack/wiki/Loader)

[查看更多插件](https://github.com/tpack/tpack/wiki/插件)

## 脚手架
- [展示型网站(jQuery)](https://github.com/tpack/tpack/wiki/脚手架-jQuery)
- [React](https://github.com/tpack/tpack/wiki/脚手架-React)
- [Vue](https://github.com/tpack/tpack/wiki/脚手架-Vue)
- [Ant.Design](https://github.com/tpack/tpack/wiki/脚手架-Antd)
- [Element](https://github.com/tpack/tpack/wiki/脚手架-Element)
- [TealUI](https://github.com/tpack/tpack/wiki/脚手架-TealUI)
- [组件库](https://github.com/tpack/tpack/wiki/脚手架-组件库)
- [贡献我的脚手架](https://github.com/tpack/tpack/wiki/贡献我的脚手架)

## 贡献
TPack 完全开源免费，欢迎任何形式的贡献：
- [关注项目](https://github.com/tpack/tpack/subscription)
- [提交 BUG & 需求](https://github.com/tpack/tpack/issues)
- [分享你的插件](https://github.com/tpack/tpack/wiki/分享插件)

[npm-url]: https://www.npmjs.com/package/tpack
[npm-image]: https://img.shields.io/npm/v/tpack.svg
[downloads-image]: https://img.shields.io/npm/dm/tpack.svg
[downloads-url]: http://badge.fury.io/js/tpack
[travis-url]: https://travis-ci.org/tpack/tpack
[travis-image]: https://img.shields.io/travis/tpack/tpack.svg
[coveralls-url]: https://coveralls.io/github/tpack/tpack
[coveralls-image]: https://img.shields.io/coveralls/tpack/tpack/master.svg
[gitter-url]: https://gitter.im/tpack/tpack
[gitter-image]: https://img.shields.io/badge/gitter-tpack%2Ftpack-brightgreen.svg