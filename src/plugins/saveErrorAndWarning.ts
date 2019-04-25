import { Builder } from "../core/builder"
import { ModuleLogEntry, Module } from "../core/module"

export default class {
	apply(builder: Builder) {
		builder.on("buildError", (log: ModuleLogEntry, module: Module) => saveLog("error", log, module))
		builder.on("buildWarning", (log: ModuleLogEntry, module: Module) => saveLog("warning", log, module))

		async function saveLog(type: string, log: ModuleLogEntry, module: Module) {
			const path = builder.getOutputPath(module.originalPath).replace(/\.[^\.]+$/, ".errors.json")
			const data = await readJSON(path) || []
			log = {
				...log,
				type: type,
				fileName: builder.relativePath(log.fileName!)
			} as any
			delete log.error
			data.push(log)
			writeJSON(path, data)
		}

		async function readJSON(path: string) {
			try {
				return JSON.parse(await builder.fs.readFile(path, "utf-8"))
			} catch {
				return undefined
			}
		}

		async function writeJSON(path: string, data: any) {
			await builder.fs.writeFile(path, JSON.stringify(data, undefined, 2))
		}
	}
}