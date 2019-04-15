import { Builder, BuilderOptions } from "./src/core/builder"
import { exec } from "./src/utils/process"

export default function () {
	return build()
}

export function build() {
	return {
		rootDir: ".",
		outDir: "dist",
		match: ["./src", "!./src/tsconfig.json", "./locales", "./configs", "./package.json", "./README.md", "./LICENSE"],
		compilers: [
			{ match: "src/**/*", outPath: "<path>" },
			{
				match: "*.ts",
				process(module) {
					module.content = module.content.replace(/\.\.\/(\.\.\/|package)/g, "$1")
				}
			},
			{
				match: "./package.json",
				process(module) {
					module.content = module.content.replace(/\.\/dist/g, "./")
				}
			},
			{
				match: "*.ts",
				use: "./src/compilers/typescript",
				options: { path: "./tsconfig.json", noTypeCheck: true, declaration: true, target: "es2018", module: "commonjs" }
			},
		],
		bundler: {
			target: "node"
		},
		sourceMap: false
	} as BuilderOptions
}

export async function test() {
	await exec("npm run test")
}

export async function coverage() {
	await exec("npm run coverage")
}

// 允许直接执行配置文件
if (process.mainModule === module) {
	const options = exports[process.argv[2] || "default"]()
	if (typeof options === "object") {
		new Builder(options).run()
	}
}