import { Builder, Module, VFile } from "../../src/core/builder"
import { Resolver } from "../../src/utils/resolver"
import { Matcher } from "../../src/utils/matcher"

const inspector = require("inspector")
if (!inspector.url()) {
	inspector.open(undefined, undefined, true)
}

const entryA = new Module("A")
const entryB = new Module("B")
const entryC = new Module("C")
const entryD = new Module("D")
const entryE = new Module("E")

const moduleA = new Module("a")
const moduleB = new Module("b")
const moduleC = new Module("c")
const moduleD = new Module("d")
const moduleE = new Module("e")
const moduleF = new Module("f")
const moduleG = new Module("<g>")

entryA.addImport("a").module = moduleA
entryA.addImport("b").module = moduleB
entryA.addImport("c").module = moduleC
entryA.addImport("d").module = moduleD

entryB.addImport("a").module = moduleA
entryB.addImport("b").module = moduleB
entryB.addImport("C").module = entryC

entryC.addImport("b").module = moduleB
entryC.addImport("D").module = entryD

entryD.addImport("c").module = moduleC
entryD.addImport("d").module = moduleD
entryD.addImport("B").module = entryB

entryE.addImport("e").module = moduleE
entryE.addImport("<g>", { dynamic: true }).module = moduleG

moduleG.addImport("f", { module: moduleF })
moduleG.addImport("E", { module: entryE })

var builder = new Builder()
builder.modules.set("A", entryA)
builder.modules.set("B", entryB)
builder.modules.set("C", entryC)
builder.modules.set("D", entryD)
builder.modules.set("E", entryE)

entryA.isMainModule = entryB.isMainModule = entryC.isMainModule = entryD.isMainModule = entryE.isMainModule = true
entryA.type = entryB.type = entryC.type = entryD.type = entryE.type = moduleA.type = moduleB.type = moduleC.type = moduleD.type = moduleE.type = moduleF.type = moduleG.type = "js"
entryA.size = entryB.size = entryC.size = entryD.size = entryE.size = moduleA.size = moduleB.size = moduleC.size = moduleD.size = moduleE.size = moduleF.size = moduleG.size = 1

builder["_bundleJSModules"]([
	new VFile("A"),
	new VFile("B"),
	new VFile("C"),
	new VFile("D"),
	new VFile("E"),
])

// const b = new Builder({
// 	rootDir: "fixtures",
// 	outDir: "_out",
// 	logger: {
// 		colors: true,
// 		progress: true,
// 	},
// 	compilers: [
// 		{
// 			match: "tpack.*",
// 			process(file) {
// 				console.log(file.originalPath)
// 				file.content += "//  haha"
// 				file.addError({
// 					message: "不对"
// 				})
// 				file.addWarning({
// 					message: "不对"
// 				})
// 			}
// 		}
// 	]
// })

// var x = new Resolver({}, b.fs) as any
// x.matcher = new Matcher("*")
// b.resolvers.push(x)

// // b.bundlers["*"] = (file, module) => {
// // 	module.addDependency({ name: "./module1.js" })
// // }

// debugger

// b.build().then(x => console.log(x))
