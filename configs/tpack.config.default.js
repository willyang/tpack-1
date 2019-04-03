export default {
	rootDir: "src", // 需要把 src 下的所有入口文件都打包到 dist
	outDir: "dist", // 生成到 dist
	exclude: "./src/components/**", // src/components 不主动打包到 dist，只有在被依赖时合并到其它入口文件

	compilers: [ // 所有文件（包括 node_modules）都会按配置顺序执行编译器
		{ match: "src/static/**", break: true }, // src/static 不作任何编译直接复制到 dist

		{ match: "*.less", use: "tpack/compilers/less" }, // 编译 less
		{ match: "*.{sass,scss}", use: "tpack/compilers/sass" }, // 编译 sass
		{ match: "*.styl", use: "tpack/compilers/stylus" }, // 编译 stylus
		{ match: ["*.css", "!**/node_modules/**"], use: "tpack/compilers/autoprefixer" }, // css 自动添加后缀

		{ match: ["*.{js,jsx}", "!**/node_modules/**"], use: "tpack/compilers/babel" }, // 编译 jsx
		{ match: ["*.{ts,tsx}", "!*.d.ts"], use: "tpack/compilers/typescript" }, // 编译 typescript

		{ match: "*.vue", use: "tpack/compilers/vue" }, // 编译 vue
		{ match: "*.svg", use: "tpack/compilers/svg" }, // 编译 svg 图标
	],

	bundler: { // 模块依赖打包合并的配置
		resolver: {
			modules: ["./src/components", "node_modules"] // import "x" 时，"x" 从 src/components 和 node_modules 搜索
		},
		commonJSModules: [
			{ match: "**/node_modules", outPath: "assets/vendors.<name>.js", minSize: 10000, maxSize: 500000, maxInitialRequests: 3, maxAsyncRequests: 5 },
			{ outPath: "assets/commons.<name>.js", minSize: 10000, maxSize: 500000, maxInitialRequests: 3, maxAsyncRequests: 5 },
		],
		extractCSSModules: true, // 独立 JS 关联的 CSS 文件
		externalModules: [ // 从 node_modules 导入的外部资源拷贝的路径
			{ match: "*.{png|jpg|gif|svg|wbmp|bmp|ico|jpe|jpeg|cur|webp|jfif}", outPath: "assets/images/<path>" },
			{ match: "*.{eot|ttf|tif|tiff|woff|woff2}", outPath: "assets/fonts/<path>" },
			{ outPath: "assets/resources/<path>" }
		],
		inlineModules: { // 内联资源文件
			query: "inline", // import "x?inline" 强制内联
			maxSize: 5000 // 如果文件小于 5k，强制内联
		},
		treeShaking: true, // 启用 Tree Shaking
		scopeHoisting: true // 启用 Scope Hoisting
	},

	optimize: false,
	optimizers: [ // 如果 tpack -p 或 optimize 为 true，则额外执行以下编译器
		{ match: ["*.js", "!*.min.js"], use: "tpack/optimizers/js" }, // 压缩 js
		{ match: ["*.css", "!*.min.css"], use: "tpack/optimizers/css" }, // 压缩 css
		{ match: "*.{html,htm}", use: "tpack/optimizers/html" } // 压缩 html
	],

	sourceMap: true, // 生成 Source Map，方便调试
	clean: true, // 构建前先清理 dist
	devServer: "http://0.0.0.0:8000" // 启动开发服务器
}