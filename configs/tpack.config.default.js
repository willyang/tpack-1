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
			modules: ["./src/components", "node_modules"] // import "x" 时，"x" 从 src/components 和 node_modules 搜索
		},
		externalModules: [ // node_modules 的外部资源需要拷贝到项目里，或者内联
			{ match: "*.{png|jpg|gif|svg|wbmp|bmp|ico|jpe|jpeg|cur|webp|jfif}", minSize: 2048, outPath: "assets/images/<name><ext>" },
			{ match: "*.{eot|ttf|tif|tiff|woff|woff2}", minSize: 2048, outPath: "assets/fonts/<name><ext>" },
			{ minSize: 2048, outPath: "assets/resources/<name><ext>" }
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
		{ match: "*.{html,htm}", use: "tpack/optimizers/html" } // 压缩 html
	],

	sourceMap: true, // 生成 Source Map，方便调试
	clean: true, // 构建前先清理 dist
	devServer: "http://0.0.0.0:8000", // 启动开发服务器
	installCommand: "npm install <module> --colors" // 用于自动安装模块的命令，设为 false 可禁用自动下载
}