import * as assert from "assert"
import { resolve, sep } from "path"
import * as vfile from "../../src/core/vfile"
import { SourceMapBuilder } from "../../src/utils/sourceMap"

export namespace vfileTest {

	export function hashTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		const oldHash = file.hash
		file.reset(vfile.VFileState.initial)
		assert.notStrictEqual(file.hash, oldHash)
		assert.notStrictEqual(file.clone().hash, oldHash)
	}

	export function resetTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		file.setProp("1", "2")
		file.addDependency("1")
		file.addReference("1")
		file.addSibling("1", "2")
		file.addError("1")
		file.addWarning("1")
		file.reset(vfile.VFileState.deleted)
		assert.strictEqual(file.props ? file.props.size : 0, 0)
		assert.strictEqual(file.dependencies ? file.dependencies.size : 0, 0)
		assert.strictEqual(file.references ? file.references.size : 0, 0)
		assert.strictEqual(file.siblings ? file.siblings.length : 0, 0)
		assert.strictEqual(file.errors ? file.errors.length : 0, 0)
		assert.strictEqual(file.warnings ? file.warnings.length : 0, 0)
	}

	export function cloneTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		file.setProp("1", "2")
		file.addDependency("1")
		file.addReference("1")
		file.addSibling("1", "2")
		file.addError("1")
		file.addWarning("1")
		file.clone().addError("1")
		assert.strictEqual(file.props ? file.props.size : 0, 1)
		assert.strictEqual(file.dependencies ? file.dependencies.size : 0, 1)
		assert.strictEqual(file.references ? file.references.size : 0, 1)
		assert.strictEqual(file.siblings ? file.siblings.length : 0, 1)
		assert.strictEqual(file.errors ? file.errors.length : 0, 1)
		assert.strictEqual(file.warnings ? file.warnings.length : 0, 1)
	}

	export function pathTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.strictEqual(file.originalPath, "foo/entry.jsx")
		assert.strictEqual(file.path, "foo/entry.jsx")

		file.path = "foo/moved.js"
		assert.strictEqual(file.path, "foo/moved.js")
	}

	export function dirTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.strictEqual(file.dir, "foo")
		file.dir = "goo"
		assert.strictEqual(file.dir, "goo")
		assert.strictEqual(file.path, "goo/entry.jsx")
	}

	export function nameTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.strictEqual(file.name, "entry")
		file.name = "moved"
		assert.strictEqual(file.name, "moved")
		assert.strictEqual(file.path, "foo/moved.jsx")
	}

	export function extTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.strictEqual(file.ext, ".jsx")
		file.ext = ".js"
		assert.strictEqual(file.ext, ".js")
		assert.strictEqual(file.path, "foo/entry.js")
	}

	export function prependNameTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		file.prependName("this_")
		assert.strictEqual(file.path, "foo/this_entry.jsx")
	}

	export function appendNameTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		file.appendName(".min")
		assert.strictEqual(file.path, "foo/entry.min.jsx")
	}

	export function resolvePathTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.strictEqual(file.resolvePath("href"), `foo${sep}href`)
		assert.strictEqual(file.resolvePath(resolve("href")), resolve("href"))
	}

	export function relativePathTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.strictEqual(file.relativePath("href"), `../href`)
	}

	export function contentTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.strictEqual(file.content, undefined)

		file.content = "content"
		assert.strictEqual(file.content, "content")
		assert.strictEqual(file.buffer.toString(), "content")

		file.buffer = Buffer.from("content")
		assert.strictEqual(file.content, "content")
		assert.strictEqual(file.buffer.toString(), "content")

		file.data = { toString() { return "content" } }
		assert.strictEqual(file.content, "content")
		assert.strictEqual(file.buffer.toString(), "content")
	}

	export function bufferTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.strictEqual(file.buffer, undefined)

		file.buffer = Buffer.from("content")
		assert.strictEqual(file.buffer.toString(), "content")
		assert.strictEqual(file.content, "content")

		file.content = "content"
		assert.strictEqual(file.buffer.toString(), "content")
		assert.strictEqual(file.content, "content")

		file.data = { toString() { return "content" } }
		assert.strictEqual(file.buffer.toString(), "content")
		assert.strictEqual(file.content, "content")
	}

	export function sizeTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.strictEqual(file.size, 0)

		file.buffer = Buffer.alloc(11)
		assert.strictEqual(file.size, 11)

		file.content = Buffer.alloc(11).toString()
		assert.strictEqual(file.size, 11)

		file.data = { toString() { return "content" } }
		assert.strictEqual(file.size, Buffer.from("content").length)
	}

	export function md5Test() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.strictEqual(file.md5, undefined)
		file.content = "foo"
		assert.strictEqual(file.md5, "acbd18db4cc2f85cedef654fccc4a4d8")

		file.buffer = Buffer.from("foo")
		assert.strictEqual(file.md5, "acbd18db4cc2f85cedef654fccc4a4d8")
	}

	export function sha1Test() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.strictEqual(file.sha1, undefined)
		file.content = "foo"
		assert.strictEqual(file.sha1, "0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33")

		file.buffer = Buffer.from("foo")
		assert.strictEqual(file.sha1, "0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33")
	}

	export function sourceMapDataTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.deepStrictEqual(file.sourceMapData, undefined)
		file.sourceMapData = JSON.stringify({ version: 3, mappings: "", sources: ["source"] })
		assert.deepStrictEqual(JSON.parse(file.sourceMapString), { version: 3, file: "foo/entry.jsx", mappings: "", sources: [`foo${sep}source`] })
		assert.deepStrictEqual(file.sourceMapObject, { version: 3, file: "foo/entry.jsx", mappings: "", sources: [`foo${sep}source`] })
		assert.deepStrictEqual(file.sourceMapBuilder.toJSON(), { version: 3, file: "foo/entry.jsx", mappings: "", sources: [`foo${sep}source`] })
	}

	export function sourceMapStringTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.deepStrictEqual(file.sourceMapString, undefined)
		file.sourceMapString = JSON.stringify({ version: 3, mappings: "", sources: ["source"] })
		assert.deepStrictEqual(JSON.parse(file.sourceMapString), { version: 3, file: "foo/entry.jsx", mappings: "", sources: [`foo${sep}source`] })
		assert.deepStrictEqual(file.sourceMapObject, { version: 3, file: "foo/entry.jsx", mappings: "", sources: [`foo${sep}source`] })
		assert.deepStrictEqual(file.sourceMapBuilder.toJSON(), { version: 3, file: "foo/entry.jsx", mappings: "", sources: [`foo${sep}source`] })
	}

	export function sourceMapObjectTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.deepStrictEqual(file.sourceMapObject, undefined)
		file.sourceMapObject = { version: 3, mappings: "", sources: ["source"] }
		assert.deepStrictEqual(JSON.parse(file.sourceMapString), { version: 3, file: "foo/entry.jsx", mappings: "", sources: [`foo${sep}source`] })
		assert.deepStrictEqual(file.sourceMapObject, { version: 3, file: "foo/entry.jsx", mappings: "", sources: [`foo${sep}source`] })
		assert.deepStrictEqual(file.sourceMapBuilder.toJSON(), { version: 3, file: "foo/entry.jsx", mappings: "", sources: [`foo${sep}source`] })
	}

	export function sourceMapBuilderTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.deepStrictEqual(file.sourceMapBuilder, undefined)
		file.sourceMapBuilder = new SourceMapBuilder({ version: 3, mappings: "", sources: ["source"] })
		assert.deepStrictEqual(JSON.parse(file.sourceMapString), { version: 3, file: "foo/entry.jsx", mappings: "", sources: [`foo${sep}source`] })
		assert.deepStrictEqual(file.sourceMapObject, { version: 3, file: "foo/entry.jsx", mappings: "", sources: [`foo${sep}source`] })
		assert.deepStrictEqual(file.sourceMapBuilder.toJSON(), { version: 3, file: "foo/entry.jsx", mappings: "", sources: [`foo${sep}source`] })
	}

	export function applySourceMapTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		file.applySourceMap({ version: 3, mappings: "", sources: ["source"], sourcesContent: ["content"], names: ["name"] })
		assert.deepStrictEqual(JSON.parse(file.sourceMapString), { version: 3, file: "foo/entry.jsx", mappings: "", sources: [`foo${sep}source`], sourcesContent: ["content"], names: ["name"] })
		assert.deepStrictEqual(file.sourceMapObject, { version: 3, file: "foo/entry.jsx", mappings: "", sources: [`foo${sep}source`], sourcesContent: ["content"], names: ["name"] })
		assert.deepStrictEqual(file.sourceMapBuilder.toJSON(), { version: 3, file: "foo/entry.jsx", mappings: "", sources: [`foo${sep}source`], sourcesContent: ["content"], names: ["name"] })
		file.applySourceMap({ version: 3, mappings: "", sources: ["source"] })
	}

	export function propTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.strictEqual(file.getProp("key"), undefined)
		assert.strictEqual(file.deleteProp("key"), false)
		file.setProp("key", "value")
		assert.strictEqual(file.getProp("key"), "value")
		assert.strictEqual(file.deleteProp("key"), true)
		assert.strictEqual(file.getProp("key"), undefined)
		assert.strictEqual(file.deleteProp("key"), false)
	}

	export function createSubfileTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.strictEqual(file.createSubfile("other").path, `foo${sep}other`)

		assert.strictEqual(file.createSubfile().sourceFile, file)
		assert.strictEqual(file.createSubfile().createSubfile().originalFile, file)
	}

	export function addSiblingTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		assert.strictEqual(file.addSibling("other", "slibing").path, `foo${sep}other`)

		const sibling = file.addSibling("other", "sibling")
		assert.strictEqual(sibling.state, vfile.VFileState.initial)
		file.state = vfile.VFileState.deleted
		assert.strictEqual(sibling.state, vfile.VFileState.deleted)
		assert.strictEqual(sibling.noWrite, file.noWrite)

		assert.strictEqual(file.addSibling(resolve("other"), "slibing").path, resolve("other"))
	}

	export function addDependencyTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		file.addDependency(["f1", new vfile.VFile("f2", true)])
		assert.strictEqual(file.dependencies!.size, 2)
		file.clearDependencies()
		assert.strictEqual(file.dependencies!.size, 0)
	}

	export function addReferenceTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		file.addReference(["f1", new vfile.VFile("f2", true)])
		assert.strictEqual(file.references!.size, 2)
		file.clearReferences()
		assert.strictEqual(file.references!.size, 0)
	}

	export function addErrorTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		file.content = "content"
		assert.strictEqual(file.hasErrors, false)
		file.addError("error")
		assert.strictEqual(file.hasErrors, true)
		file.addError(new Error("error"))
		file.addError({ message: "error" })
		file.addError({ message: "error", fileName: "foo" })
		file.addError({ message: "error", fileName: "foo/entry.jsx" })
		file.addError({ message: "error", fileName: "entry.jsx", index: 0, endIndex: 0 })
		assert.strictEqual(file.addError({ error: new Error("error") }).message, "error")
		assert.strictEqual(file.addError({ error: new String("error") as any }).message, "error")

		file.buffer = Buffer.from("content")
		assert.strictEqual(file.addError({}).content, "content")
	}

	export function addWarningTest() {
		const file = new vfile.VFile("foo/entry.jsx", true)
		file.content = "content"
		assert.strictEqual(file.hasWarnings, false)
		file.addWarning("warning")
		assert.strictEqual(file.hasWarnings, true)
	}

	export namespace computeOriginalLocationTest {

		export function unmodified() {
			const file = new vfile.VFile("foo/entry.jsx", true)
			file.content = "0123456"
			const subfile = file.createSubfile("sub.jsx", "3456", 3)
			assert.strictEqual(subfile.addError({ index: 1 }).fileName, "foo/entry.jsx")
			assert.strictEqual(subfile.addError({ index: 1 }).line, 0)
			assert.strictEqual(subfile.addError({ index: 1 }).column, 4)
			assert.strictEqual(subfile.addError({ index: 1, endIndex: 1 }).endLine, 0)
			assert.strictEqual(subfile.addError({ index: 1, endIndex: 1 }).endColumn, 4)
		}

		export function sourceModified() {
			const file = new vfile.VFile("foo/entry.jsx", true)
			file.content = "0123456"

			file.content = "abcdefg"
			file.sourceMapBuilder = new SourceMapBuilder()
			file.sourceMapBuilder.addMapping(0, 0, "source", 100, 100)

			const subfile = file.createSubfile("sub.jsx", "3456", 3)
			assert.strictEqual(subfile.addError({ index: 1 }).fileName, "source")
			assert.strictEqual(subfile.addError({ index: 1 }).line, 100)
			assert.strictEqual(subfile.addError({ index: 1 }).column, 104)
		}

		export function sourceModifiedWithoutSource() {
			const file = new vfile.VFile("foo/entry.jsx", true)
			file.content = "0123456"

			file.content = "abcdefg"
			file.sourceMapBuilder = new SourceMapBuilder()
			file.sourceMapBuilder.addMapping(0, 0)

			const subfile = file.createSubfile("sub.jsx", "3456", 3)
			assert.strictEqual(subfile.addError({ index: 1 }).fileName, "foo/entry.jsx")
			assert.strictEqual(subfile.addError({ index: 1 }).line, 0)
			assert.strictEqual(subfile.addError({ index: 1 }).column, 4)
		}

		export function sourceModifiedWithoutSourceMap() {
			const file = new vfile.VFile("foo/entry.jsx", true)
			file.content = "0123456"

			file.content = "abcdefg"

			const subfile = file.createSubfile("sub.jsx", "3456", 3)
			assert.strictEqual(subfile.addError({ index: 1 }).fileName, "foo/entry.jsx")
			assert.strictEqual(subfile.addError({ index: 1 }).line, 0)
			assert.strictEqual(subfile.addError({ index: 1 }).column, 4)
		}

		export function childModified() {
			const file = new vfile.VFile("foo/entry.jsx", true)
			file.content = "0123456"

			const subfile = file.createSubfile("../sub.jsx", "3456", 3)

			subfile.content = "abcdefg"
			subfile.sourceMapBuilder = new SourceMapBuilder()
			subfile.sourceMapBuilder.addMapping(0, 0, "source", 100, 100)
			subfile.sourceMapBuilder.addMapping(0, 4, "foo/entry.jsx", 200, 200)

			assert.strictEqual(subfile.addError({ index: 1 }).fileName, "source")
			assert.strictEqual(subfile.addError({ index: 1 }).line, 100)
			assert.strictEqual(subfile.addError({ index: 1 }).column, 101)

			assert.strictEqual(subfile.addError({ index: 0, endIndex: 0 }).fileName, "source")
			assert.strictEqual(subfile.addError({ index: 0, endIndex: 0 }).line, 100)
			assert.strictEqual(subfile.addError({ index: 0, endIndex: 0 }).column, 100)

			assert.strictEqual(subfile.addError({ index: 5, computeOriginalLocation: false }).fileName, "sub.jsx")
			assert.strictEqual(subfile.addError({ index: 5, computeOriginalLocation: false }).line, 0)
			assert.strictEqual(subfile.addError({ index: 5, computeOriginalLocation: false }).column, 5)
		}

		export function childModifiedWithoutSourceMap() {
			const file = new vfile.VFile("foo/entry.jsx", true)
			file.content = "0123456"
			const subfile = file.createSubfile("sub.jsx", "3456", 3)
			subfile.content = "abcdefg"
			assert.strictEqual(subfile.addError({ index: 1 }).fileName, `foo${sep}sub.jsx`)
			assert.strictEqual(subfile.addError({ index: 1 }).line, 0)
			assert.strictEqual(subfile.addError({ index: 1 }).column, 1)
		}

		export function bothModified() {
			const file = new vfile.VFile("foo/entry.jsx", true)
			file.content = "0123456"

			file.content = "abcdefg"
			file.sourceMapBuilder = new SourceMapBuilder()
			file.sourceMapBuilder.addMapping(0, 0, "source1", 10, 10)

			const subfile = file.createSubfile("../sub.jsx", "3456", 3)

			subfile.content = "abcdefg"
			subfile.sourceMapBuilder = new SourceMapBuilder()
			subfile.sourceMapBuilder.addMapping(0, 0, "source2", 100, 100)
			subfile.sourceMapBuilder.addMapping(0, 4, "sub.jsx", 200, 200)

			assert.strictEqual(subfile.addError({ index: 1 }).fileName, "source2")
			assert.strictEqual(subfile.addError({ index: 1 }).line, 100)
			assert.strictEqual(subfile.addError({ index: 1 }).column, 101)

			assert.strictEqual(subfile.addError({ index: 5 }).fileName, "source1")
			assert.strictEqual(subfile.addError({ index: 5 }).line, 210)
			assert.strictEqual(subfile.addError({ index: 5 }).column, 201)
			assert.strictEqual(subfile.addError({ index: 5, endIndex: 5 }).endLine, 210)
			assert.strictEqual(subfile.addError({ index: 5, endIndex: 5 }).endColumn, 201)

			assert.strictEqual(subfile.addError({ index: 1, endIndex: 5 }).endLine, undefined)
			assert.strictEqual(subfile.addError({ index: 1, endIndex: 5 }).endColumn, undefined)
		}

		export function forbidon() {
			const file = new vfile.VFile("foo/entry.jsx", true)
			file.content = "0123456"
			const subfile = file.createSubfile("../sub.jsx", "3456", 3)
			assert.strictEqual(subfile.addError({ index: 5, computeOriginalLocation: false }).fileName, "sub.jsx")
			assert.strictEqual(subfile.addError({ index: 5, computeOriginalLocation: false }).line, 0)
			assert.strictEqual(subfile.addError({ index: 5, computeOriginalLocation: false }).column, 5)
		}

	}

}