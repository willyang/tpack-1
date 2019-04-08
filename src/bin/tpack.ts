#!/usr/bin/env node
import { existsSync } from "fs"
import { join, dirname } from "path"
import { LogLevel } from "../core/logger"
import { BuilderOptions, Builder } from "../core/builder"
import { Matcher } from "../utils/matcher"

main()

/** 命令行入口 */
async function main() {

	// 优先执行本地安装的版本
	const localCli = searchFile(["node_modules/tpack/bin/tpack.js"])
	if (localCli && localCli !== __filename && require(localCli) !== exports) {
		return
	}

	process.on("unhandledRejection", error => {
		if (error) {
			console.error(error)
		}
		process.exit(-1)
	})

	const { i18n, service } = require("../core/i18n") as typeof import("../core/i18n")
	const { parseCommandLineArguments, formatCommandLineOptions, extensions, loadConfigFile } = require("../core/cli") as typeof import("../core/cli")
	const commandLineOptions = {
		"--help": {
			group: "Options",
			alias: ["-?", "-h"],
			description: "Show help",
			execute() {
				process.stdout.write(i18n`TPack v${version()}` + "\n\n")
				process.stdout.write(i18n`Usage: tpack [task=default] [options]` + "\n")
				process.stdout.write(formatCommandLineOptions(commandLineOptions) + "\n")
			}
		},
		"--version": {
			alias: ["-v", "-V"],
			description: "Show version number",
			execute() {
				process.stdout.write(version())
			}
		},

		"--cwd": {
			group: "Configuration Options",
			argument: "<path>",
			description: "Specify the current working directory",
			apply(options: BuilderOptions, argument: string) {
				options.baseDir = argument
			}
		},
		"--require": {
			alias: "-r",
			argument: "<module>",
			description: "Preload one or more modules before loading the configuration file",
			multipy: true,
			execute(argument: string[]) {
				for (const module of argument) {
					require(module)
				}
			}
		},
		"--config": {
			argument: "<path>",
			description: "Specify the path to the configuration file [default: tpack.config.js]",
		},
		"--tasks": {
			alias: "-t",
			description: "Show available tasks in loaded configuration file"
		},
		"--init": {
			argument: "[type]",
			description: "Initialize a new project",
			default: "",
			execute(argument: string) {
				notImplemented("--init")
			}
		},
		"--debug": {
			alias: "-d",
			argument: "[[host:]port]",
			description: "Activate inspector on [host:port]",
			default: "127.0.0.1:9229",
			execute() {
				const inspector = require("inspector") as typeof import("inspector")
				if (!inspector.url()) {
					let host: string | undefined, port: string | undefined
					const debug = args["--debug"]
					if (typeof debug === "string") {
						const colon = debug.indexOf(":")
						host = colon < 0 ? undefined : debug.slice(0, colon)
						port = colon < 0 ? debug : debug.slice(colon + 1)
					}
					inspector.open(port as any, host, true)
				}
			}
		},

		"--build": {
			group: "Mode Options",
			alias: "-b",
			description: "Build all files and exit, disable watching and development server",
			apply(options: BuilderOptions) {
				options.devServer = options.watch = false
			}
		},
		"--publish": {
			alias: "-p",
			description: "Enable optimizers",
			apply(options: BuilderOptions) {
				options.devServer = options.watch = false
				options.optimize = true
			}
		},
		"--watch": {
			alias: "-w",
			description: "Watch files and build incrementally",
			apply(options: BuilderOptions) {
				if (!options.watch) {
					options.watch = true
				}
			}
		},
		"--server": {
			alias: "-s",
			argument: "[[host:]port]",
			description: "Start a local development server",
			default: "127.0.0.1:8088",
			apply(options: BuilderOptions, argument: string) {
				if (options.devServer && typeof options.devServer === "object") {
					options.devServer.url = argument
				} else {
					options.devServer = argument
				}
			}
		},
		"--open": {
			argument: "[app]",
			description: "Open in browser when local development server started",
			default: "",
			apply(options: BuilderOptions, argument: string) {
				if (options.devServer && typeof options.devServer === "object") {
					options.devServer.open = argument || true
				} else {
					options.devServer = { url: options.devServer as any, open: argument || true }
				}
			}
		},
		"--no-emit": {
			description: "Build all files, but do not save to disk",
			apply(options: BuilderOptions) {
				options.noEmit = true
			}
		},
		"--bail": {
			description: "Report the first error as a hard error instead of tolerating it",
			apply(options: BuilderOptions) {
				options.bail = true
			}
		},

		"--output": {
			alias: "-o",
			group: "Build Options",
			argument: "<dir>",
			description: "Specify the output directory",
			apply(options: BuilderOptions, argument: string) {
				options.outDir = argument
			}
		},
		"--clean": {
			alias: "-c",
			description: "Clean the output directory before build",
			apply(options: BuilderOptions) {
				options.clean = true
			}
		},
		"--match": {
			alias: "-m",
			argument: "<glob>",
			description: "Specify the files to build",
			multipy: true
		},
		"--exclude": {
			alias: "-x",
			argument: "<glob>",
			description: "Specify the files to be skipped",
			multipy: true
		},
		"--no-path-check": {
			description: "Disable path checking and allow overwriting source files",
			apply(options: BuilderOptions) {
				options.noPathCheck = true
			}
		},
		"--source-map": {
			description: "Generate source maps if available",
			apply(options: BuilderOptions) {
				if (!options.sourceMap) {
					options.sourceMap = true
				}
			}
		},
		"--no-source-map": {
			description: "Disabled source maps",
			apply(options: BuilderOptions) {
				options.sourceMap = false
			}
		},

		"--silent": {
			group: "Logging Options",
			description: "Prevent all outputs",
			apply(options: BuilderOptions) {
				const loggerOptions = (options.logger || (options.logger = {}))
				loggerOptions.logLevel = LogLevel.silent
			}
		},
		"--error-only": {
			description: "Print errors only",
			apply(options: BuilderOptions) {
				const loggerOptions = (options.logger || (options.logger = {}))
				loggerOptions.logLevel = LogLevel.error
			}
		},
		"--info-only": {
			description: "Print errors, warnings and important information only",
			apply(options: BuilderOptions) {
				const loggerOptions = (options.logger || (options.logger = {}))
				loggerOptions.logLevel = LogLevel.info
			}
		},
		"--verbose": {
			description: "Print all outputs",
			apply(options: BuilderOptions) {
				const loggerOptions = (options.logger || (options.logger = {}))
				loggerOptions.logLevel = LogLevel.verbose
			}
		},
		"--colors": {
			description: "Enable colorized outputs",
			apply(options: BuilderOptions) {
				const loggerOptions = (options.logger || (options.logger = {}))
				loggerOptions.colors = true
			}
		},
		"--no-colors": {
			description: "Disable colorized outputs",
			apply(options: BuilderOptions) {
				const loggerOptions = (options.logger || (options.logger = {}))
				loggerOptions.colors = false
			}
		},
		"--progress": {
			description: "Show build progress",
			apply(options: BuilderOptions) {
				const loggerOptions = (options.logger || (options.logger = {}))
				loggerOptions.spinner = true
			}
		},
		"--no-progress": {
			description: "Hide build progress",
			apply(options: BuilderOptions) {
				const loggerOptions = (options.logger || (options.logger = {}))
				loggerOptions.spinner = false
			}
		},
		"--full-path": {
			description: "Print absolute paths in outputs",
			apply(options: BuilderOptions) {
				const loggerOptions = (options.logger || (options.logger = {}))
				loggerOptions.printFullPath = true
			}
		},
		"--locale": {
			argument: "<locale>",
			description: "Specify the locale of messages, e.g. zh-CN",
			apply(options: BuilderOptions, argument: string) {
				options.locale = argument
			}
		},

		"--no-es-module": {
			group: "Advanced Options",
			description: "Disable ESModule support for .js files",
		},
		"--no-v8-cache": {
			description: "Disable v8 cache",
		},
		"--parallel": {
			argument: "[number]",
			description: "Build files in parallel",
			default: 1,
			apply(options: BuilderOptions, argument: string) {
				options.parallel = +argument || 1
				notImplemented("--parallel")
			}
		},
		"--init-completion": {
			argument: "[bash]",
			description: "Initialize tab completion for current environment",
			default: "bash",
			execute(argument: string) {
				notImplemented("--init-completion")
			}
		},
		"--completion-bash": {
			argument: "<bash>",
			description: "Print completion bash",
			execute(argument: string) {
				notImplemented("--completion-bash")
			}
		},
		"--completion": {
			argument: "<prefix>",
			description: "Print completion",
			execute(argument: string) {
				notImplemented("--completion")
			}
		},

	}

	// 解析命令行参数
	let commandLineErrors: string[] | undefined
	const args = parseCommandLineArguments(commandLineOptions, message => {
		if (commandLineErrors) {
			commandLineErrors.push(message)
		} else {
			commandLineErrors = [message]
		}
	})
	if (args["--locale"]) {
		service.currentLocale = args["--locale"] as string
	}
	if (commandLineErrors) {
		// 如果命令行解析错误，且更新了界面语言，则重新计算一次错误文案
		if (args["--locale"]) {
			commandLineErrors.length = 0
			parseCommandLineArguments(commandLineOptions, message => {
				commandLineErrors!.push(message)
			})
		}
		for (const commandLineError of commandLineErrors) {
			process.stderr.write(i18n`Error: ${commandLineError}` + "\n")
		}
		process.exitCode = -6
		return
	}

	// 全局命令
	if (args["--debug"]) {
		commandLineOptions["--debug"].execute()
	}
	if (args["--require"]) {
		commandLineOptions["--require"].execute(args["--require"] as string[])
	}
	const taskName = args["0"] as string
	if (!taskName) {
		if (args["--help"]) {
			return commandLineOptions["--help"].execute()
		}
		if (args["--version"]) {
			return commandLineOptions["--version"].execute()
		}
		if (args["--init"]) {
			return commandLineOptions["--init"].execute(args["--init"] as string)
		}
		if (args["--completion-bash"]) {
			return commandLineOptions["--completion-bash"].execute(args["--completion-bash"] as string)
		}
		if (args["--init-completion"]) {
			return commandLineOptions["--init-completion"].execute(args["--init-completion"] as string)
		}
	}
	if (!args["no-v8-cache"]) {
		try {
			require("v8-compile-cache")
		} catch { }
	}

	// 搜索配置文件
	const configFile = searchFile(args["--config"] ? [args["--config"] as string] : [".js", ...Object.keys(extensions)].map(ext => `tpack.config${ext}`))
	const tasks = loadConfigFile(configFile || require.resolve("../configs/tpack.config.default.js"), !args["--no-es-module"])
	if (args["--completion"]) {
		return notImplemented("--completion")
	}
	if (args["--tasks"]) {
		process.stdout.write(i18n`Defined Tasks in '${configFile || i18n`<default config file>`}':\n${formatTaskList(Object.keys(tasks))}` + '\n')
		return
	}
	const taskNames = searchList(tasks, taskName || "default")
	if (taskNames.length !== 1) {
		process.stdout.write(i18n`Error: Task '${taskName || "default"}' is not defined in '${configFile || i18n` <default config file >`}'.` + '\n\n')
		if (taskNames.length) {
			process.stdout.write(i18n`Did you mean one of these?\n${formatTaskList(taskNames)}` + '\n')
			process.exitCode = -5
		} else {
			process.stdout.write(i18n`Defined Tasks:\n${formatTaskList(Object.keys(tasks))}` + '\n')
			process.exitCode = -4
		}
		return
	}

	// 读取并应用配置
	const task = tasks[taskNames[0]]
	const options = typeof task === "function" ? await task(args) : task
	if (typeof options === "object") {
		const { Builder } = require("../core/builder") as typeof import("../core/builder")
		for (const key in args) {
			const commandOption = (commandLineOptions as any)[key]
			if (commandOption && commandOption.apply) {
				commandOption.apply(options, args[key])
			}
		}
		let builder: Builder
		try {
			builder = new Builder(options)
		} catch (e) {
			process.stdout.write(i18n`ConfigError: ${e.message}` + '\n')
			process.exitCode = -3
			return
		}
		let filter: Matcher | undefined
		if (args["--match"] || args["--exclude"]) {
			filter = builder.createMatcher(args["--match"] as string || (() => true), args["--exclude"] as string)
		}
		try {
			process.exitCode = (await builder.run(filter)).errorCount
		} catch (e) {
			process.stdout.write(e.stack + '\n')
			process.exitCode = -2
		}
	}

	/**
	 * 在当前文件夹及上级文件夹中搜索指定名称的文件
	 * @param names 要搜索的文件名
	 * @returns 如果找到则返回绝对路径，否则返回空
	 */
	function searchFile(names: string[]) {
		let dir = process.cwd()
		let prevDir: typeof dir
		do {
			for (const name of names) {
				const fullPath = join(dir, name)
				if (existsSync(fullPath)) {
					return fullPath
				}
			}
			prevDir = dir
			dir = dirname(dir)
		} while (dir.length !== prevDir.length)
		return null
	}

	/** 获取命令行程序的版本号 */
	function version() {
		return require("../package.json").version as string
	}

	/**
	 * 搜索以指定名称开始的键
	 * @param value 要搜索的键名
	 * @returns 返回所有匹配的键列表
	 */
	function searchList(list: { [key: string]: any }, value: string) {
		if (value in list) {
			return [value]
		}
		const result: string[] = []
		for (const key in list) {
			if (key.startsWith(value)) {
				result.push(key)
			}
		}
		return result
	}

	/** 格式化任务列表 */
	function formatTaskList(tasks: string[]) {
		return tasks.map((task, index) => `${index + 1}) ${task}`).join("\n")
	}

	function notImplemented(name: string) {
		process.stderr.write(i18n`Option '${name}' is not implemented yet.` + '\n')
		process.exit(-100)
	}

}