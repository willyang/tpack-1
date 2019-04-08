import { Builder } from "../../src/core/builder"
import { Module } from "../../src/core/module"
import { FileSystem } from "../../src/utils/fileSystem"

var d = new Builder()
d.fs = new FileSystem()
d.compilers = []
let i=0
d.compilers.push({
	name: "xxx",
	processor: {
		process(module) {
			if(i++ < 10)
			console.log(module.path)
		}
	}
})

for (let i = 0; i < 10; i++) {
	//d._processModule(d.compilers, new Module("./test/core/a.ts"))
	d._processModule(d.compilers, new Module("K:\\下载的\\[龙影游戏]【NSP】【中文】【星际幽灵】Star Ghost\\Star Ghost [01002eb007d3a000][v0].nsp"))
}

