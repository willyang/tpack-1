import { Module, Dependency } from "../core/module"
import { Builder, Bundler as IBundler } from "../core/builder"
import { TextWriter, SourceMapTextWriter } from "../utils/textWriter"
import { SourceMapData, SourceMapBuilder } from "../utils/sourceMap"
import { indexToLineColumn } from "../utils/lineColumn"
import { encodeDataURI as encodeDataURI } from "../utils/base64"
import { relativePath, getDir } from "../utils/path"

/** 表示一个打包器基类 */
export abstract class Bundler implements IBundler {

	/** 获取所属的构建器 */
	readonly builder: Builder

	/**
	 * 初始化新的打包器
	 * @param options 构建器的选项
	 * @param builder 所属的构建器
	 */
	constructor(options: OutputOptions, builder: Builder) {
		this.builder = builder
		options = {
			...options,
			...builder.options.bundler && builder.options.bundler.output
		}
		this.formatURLPath = options.formatURLPath
		this.publicURL = options.publicURL
		this.appendURLQuery = typeof options.appendURLQuery === "string" ? (module, _, builder) => builder.formatPath(options.appendURLQuery as string, module!) : options.appendURLQuery
		this.formatURL = options.formatURL || ((name, query, hash) => `${name || ""}${query != undefined ? "?" + query : ""}${hash != undefined ? "#" + hash : ""}`)
		this.prepend = typeof options.prepend === "string" ? (module, builder) => builder.formatPath(options.prepend as string, module) : options.prepend
		this.append = typeof options.append === "string" ? (module, builder) => builder.formatPath(options.append as string, module) : options.append
		this.modulePrepend = typeof options.modulePrepend === "string" ? (module, _, builder) => builder.formatPath(options.modulePrepend as string, module) : options.modulePrepend
		this.moduleAppend = typeof options.moduleAppend === "string" ? (module, _, builder) => builder.formatPath(options.moduleAppend as string, module) : options.moduleAppend
		this.moduleSeperator = options.moduleSeperator != undefined ? options.moduleSeperator : "\n\n"
		this.indentString = options.indentString != undefined ? options.indentString : "  "
		this.newLine = options.newLine != undefined ? options.newLine : "\n"
	}

	/** 判断是否需要生成源映射 */
	generatesSourceMap?: boolean

	parse(module: Module) {
		if (!module.content) {
			return
		}
		const document = new TextDocument(module.originalPath, module.content, module.sourceMapBuilder)
		module.setProp(TextDocument, document)
		this.parseContent(module.content, document, module)
	}

	/** 
	 * 负责解析指定的源码内容
	 * @param content 要解析的内容
	 * @param document 当前正在解析的文档
	 * @param module 当前正在解析的模块
	 */
	protected abstract parseContent(content: string, document: TextDocument, module: Module): void

	/**
	 * 解析源码中的地址
	 * @param url 要引用的地址
	 * @param source 引用的来源名
     * @param startIndex 地址在源文件的开始索引
     * @param endIndex 地址在源文件的结束索引（不含）
	 * @param document 当前正在解析的文档
	 * @param module 当前正在解析的模块
	 * @param formatter 自定义格式化输出的函数
	 * @param inliner 自定义内联文件的函数
	 */
	protected parseURL(url: string, source: string, startIndex: number, endIndex: number, document: TextDocument, module: Module, formatter?: (url: string) => string, inliner?: (module: Module) => string) {
		const dependency = module.addDependency({
			url: url,
			source: source,
			index: startIndex,
			endIndex: endIndex,
			dynamic: true,
			optional: true
		})
		document.addReplacement(startIndex, endIndex, async containingModule => {
			const url = await this.buildURL(dependency, containingModule, inliner)
			return formatter ? formatter(url) : url
		})
	}

	/**
	 * 计算最终在生成模块中引用其它模块的地址的回调函数
	 * @param module 引用的目标模块
	 * @param containingModule 地址所在的模块
	 * @param builder 当前的构建器对象
	 * @return 返回生成的地址
	*/
	readonly formatURLPath?: (module: Module, containingModule: Module, builder: Builder) => string

	/** 最终引用模块的根地址，一般以 `/` 结尾 */
	readonly publicURL?: string

	/** 
	 * 计算在地址查询参数追加内容的回调函数
	 * @param module 引用的目标模块
	 * @param containingModule 地址所在的模块
	 * @param builder 当前的构建器对象
	 * @return 返回生成的查询参数
	 */
	readonly appendURLQuery?: (module: Module, containingModule: Module, builder: Builder) => string

	/**
	 * 计算最终在生成模块中引用其它模块的地址的回调函数
	 * @param pathname 地址的路径
	 * @param query 地址的查询参数
	 * @param hash 地址的哈希值
	 * @param containingModule 地址所在的模块
	 * @param builder 当前的构建器对象
	 * @return 返回生成的地址
	*/
	readonly formatURL: (pathname: string | undefined, query: string | undefined, hash: string | undefined, containingModule: Module, builder: Builder) => string

	/**
	 * 获取引用指定依赖的最终地址
	 * @param dependency 引用的模块
	 * @param containingModule 生成所在的目标模块
	 * @param inliner 自定义内联文件的函数
	 */
	protected async buildURL(dependency: Dependency, containingModule: Module, inliner?: (module: Module, containingModule: Module) => string) {
		// 无法解析模块，不更新地址
		const module = dependency.module
		if (!module) {
			return this.formatURL(dependency.name, dependency.query, dependency.hash, containingModule, this.builder)
		}
		// 内联模块
		const inline = dependency.inline || module.noEmit
		// 确保依赖模块已生成
		await this.builder.emitModule(module, inline)
		if (inline) {
			if (inliner) {
				return inliner(module, containingModule)
			}
			return encodeDataURI(module.type!, module.data!)
		}
		// 格式化地址
		const name = this.formatURLPath ? this.formatURLPath(module, containingModule, this.builder) : this.publicURL != undefined ? this.publicURL + this.builder.relativePath(module.path) : relativePath(getDir(containingModule.path), module.path)
		let query = dependency.query
		if (this.appendURLQuery) {
			const newQuery = this.appendURLQuery(module, containingModule, this.builder)
			query = query ? query + "&" + newQuery : newQuery
		}
		return this.formatURL(name, query, dependency.hash, containingModule, this.builder)
	}

	/**
	 * 解析内联在源码中的文件
	 * @param content 要解析的源码内容
	 * @param ext 源码的扩展名
     * @param startIndex 地址在源文件的开始索引
     * @param endIndex 地址在源文件的结束索引（不含）
	 * @param document 当前正在解析的文档
	 * @param module 当前正在解析的模块
	 * @param formatter 自定义格式化输出的函数
	 */
	protected parseSubmodule(content: string, ext: string, startIndex: number, endIndex: number, document: TextDocument, module: Module, formatter?: (content: string) => string) {
		const submodule = module.createSubmodule(`${module.originalPath}#${startIndex}${ext}`, content, startIndex)
		module.addDependency({ module: submodule })
		document.addReplacement(startIndex, endIndex, async containingModule => {
			// 如果内容的模块是 js/html/css，更新相对路径
			if (submodule.bundler instanceof Bundler) {
				const document = submodule.getProp(TextDocument) as TextDocument
				const writer = new TextWriter()
				document.write(writer, containingModule)
				submodule.content = writer.toString()
				submodule.bundler = false
			}
			await this.builder.emitModule(submodule, "text")
			return formatter ? formatter(submodule.content) : submodule.content
		})
	}

	/**
	 * 解析要内联的文件
	 * @param content 要解析的源码内容
	 * @param ext 源码的扩展名
	 * @param startIndex 地址在源文件的开始索引
	 * @param endIndex 地址在源文件的结束索引（不含）
	 * @param document 当前正在解析的文档
	 * @param module 当前正在解析的模块
	 * @param formatter 自定义格式化输出的函数
	 */
	protected parseInclude(url: string, source: string, startIndex: number, endIndex: number, document: TextDocument, module: Module, formatter?: (url: string) => string) {
		const dependency = module.addDependency({
			url: url,
			source: source,
			index: startIndex,
			endIndex: endIndex
		})
		document.addReplacement(startIndex, endIndex, async (containingModule) => {
			// 无法解析模块
			const module = dependency.module
			if (!module) {
				return ""
			}
			// 如果内容的模块是 js/html/css，更新相对路径
			const document = module.getProp(TextDocument) as TextDocument
			if (document) {
				const writer = new TextWriter()
				document.write(writer, containingModule)
				return formatter ? formatter(writer.toString()) : writer.toString()
			}
			await this.builder.emitModule(module, "text")
			return formatter ? formatter(module.content) : module.content
		})
	}

	async generate(module: Module, builder: Builder) {
		const document = module.getProp(TextDocument)
		if (!document) {
			return
		}
		const sourceMap = this.generatesSourceMap && module.generatesSourceMap
		const writer = sourceMap ? new SourceMapTextWriter() : new TextWriter()
		await document.write(writer, module)
		module.content = writer.toString()
		module.sourceMap = sourceMap ? (writer as SourceMapTextWriter).sourceMapBuilder : undefined
	}

	/**
	 * 在最终合并生成的模块开头追加的内容
	 * @param containingModule 要生成的模块
	 * @param builder 当前的构建器对象
	 * @example "/* This file is generated by tpack. DO NOT EDIT DIRECTLY!! *‌/"
	 */
	readonly prepend?: (containingModule: Module, builder: Builder) => string

	/**
	 * 在最终合并生成的模块末尾追加的内容
	 * @param containingModule 要生成的模块
	 * @param builder 当前的构建器对象
	 */
	readonly append?: (containingModule: Module, builder: Builder) => string

	/**
	 * 在每个依赖模块开头追加的内容
	 * @param module 引用的模块
	 * @param containingModule 要生成的模块
	 * @param builder 当前的构建器对象
	 */
	readonly modulePrepend?: (module: Module, containingModule: Module, builder: Builder) => string

	/**
	 * 在每个依赖模块末尾追加的内容
	 * @param module 引用的模块
	 * @param containingModule 要生成的模块
	 * @param builder 当前的构建器对象
	 */
	readonly moduleAppend?: (module: Module, containingModule: Module, builder: Builder) => string

	/** 在每个依赖模块之间插入的代码 */
	readonly moduleSeperator?: string

	/** 生成的文件中用于缩进源码的字符串 */
	readonly indentString?: string

	/** 生成的文件中用于换行的字符串 */
	readonly newLine?: string

}

/** 表示一个文本文档 */
export class TextDocument {

	/** 获取源路径 */
	readonly path: string

	/** 获取源内容 */
	readonly content: string

	/** 获取源映射 */
	readonly sourceMap?: SourceMapBuilder

	/** 获取所有的替换记录 */
	readonly replacements: {
		/** 要替换的开始索引 */
		startIndex: number
		/** 要替换的结束索引（不含） */
		endIndex: number
		/** 要替换的新内容，如果是函数则为最后根据最终模块自动计算的内容 */
		replacement: string | ((containingModule: Module) => string | Promise<string>)
	}[] = []

	/**
	 * 初始化新的文本文档
	 * @param path 源路径
	 * @param content 源内容
	 * @param sourceMap 源映射
	 */
	constructor(path: string, content: string, sourceMap?: SourceMapBuilder) {
		this.path = path
		this.content = content
		this.sourceMap = sourceMap
	}

    /**
     * 添加一个替换记录
     * @param startIndex 要替换的开始索引
     * @param endIndex 要替换的结束索引（不含）
     * @param replacement 要替换的新内容，如果是函数则为最后根据生成目标自动计算的内容
     */
	addReplacement(startIndex: number, endIndex: number, replacement: string | ((containingModule: Module) => string | Promise<string>)) {
		const entry = { startIndex, endIndex, replacement }
		let index = this.replacements.length
		for (; index > 0; index--) {
			const replacement = this.replacements[index - 1]
			if (startIndex >= replacement.startIndex) {
				break
			}
		}
		if (index >= this.replacements.length) {
			this.replacements.push(entry)
		} else {
			this.replacements.splice(index, 0, entry)
		}
	}

	/**
	 * 将当前文档的内容写入到指定的写入器
	 * @param writer 要写入的目标写入器
	 * @param containingModule 最终包含生成结果的模块
	 */
	async write(writer: TextWriter, containingModule: Module) {
		// 无替换，直接写入整个源码
		if (this.replacements.length === 0) {
			writer.write(this.content, 0, this.content.length, this.path, this.sourceMap, 0, 0)
			return
		}
		let index = 0
		for (const replacement of this.replacements) {
			// 写入上一次替换到这次更新记录中间的文本
			if (index < replacement.startIndex) {
				this._writeText(index, replacement.startIndex, writer)
			}
			// 写入替换的数据
			if (typeof replacement.replacement === "function") {
				writer.write(await replacement.replacement(containingModule))
			} else {
				writer.write(replacement.replacement)
			}
			// 更新最后一次替换位置
			index = replacement.endIndex
		}
		// 写入最后一个替换记录之后的文本
		if (index < this.content.length) {
			this._writeText(index, this.content.length, writer)
		}
	}

	/** 内容索引 */
	private _index?: number[]

	/** 写入一段文本 */
	private _writeText(startIndex: number, endIndex: number, writer: TextWriter) {
		if (writer instanceof SourceMapTextWriter) {
			const loc = indexToLineColumn(this.content, startIndex, this._index || (this._index = []))
			writer.write(this.content, startIndex, endIndex, this.path, this.sourceMap, loc.line, loc.column)
		} else {
			writer.write(this.content, startIndex, endIndex)
		}
	}

}

/** 表示最终打包生成的选项 */
export interface OutputOptions {
	/**
	 * 计算最终在生成模块中引用其它模块的地址的回调函数
	 * @param module 引用的目标模块
	 * @param containingModule 地址所在的模块
	 * @param builder 当前的构建器对象
	 * @return 返回生成的地址
	*/
	formatURLPath?: (module: Module, containingModule: Module, builder: Builder) => string
	/**
	 * 最终引用模块的根地址，一般以 `/` 结尾
	 * @description 如果需要使用 CDN，可配置成 CDN 的根地址，同时记得在发布后将相关文件上传到 CDN 服务器
	 * @default "/"
	 * @example "https://cdn.example.com/assets/"
	 */
	publicURL?: string
	/**
	 * 在地址查询参数追加的内容，如果是字符串，则其中以下标记会被替换：
	 * - `<path>`: 要生成的模块的相对路径，等价于 `<dir>/<name><ext>`
	 * - `<dir>`: 要生成的模块所在文件夹的相对路径
	 * - `<name>`: 要生成的模块的文件名（不含文件夹和扩展名部分）
	 * - `<ext>`: 要生成的模块的扩展名（含点）
	 * - `<md5>`: 要生成的模块内容的 MD5 串（小写），默认截取前 8 位，如果要截取前 n 位，使用 `<md5:n>`
	 * - `<sha1>`: 要生成的模块内容的 SHA-1 串（小写），默认截取前 8 位，如果要截取前 n 位，使用 `<sha1:n>`
	 * - `<date>`: 当前时间，默认为用户本地可读格式，如果要自定义格式，使用如 `<date:yyyyMMdd>`
	 * - `<random>`: 随机整数，默认为 8 位，如果要自定义为 n  位，使用如 `<rand:n>`
	 * - `<builder>`: 构建器的名字，默认为 `TPack`
	 * - `<version>`: 构建器的版本号
	 * @param module 引用的目标模块
	 * @param containingModule 地址所在的模块
	 * @param builder 当前的构建器对象
	 * @return 返回生成的查询参数
	 */
	appendURLQuery?: string | ((module: Module, containingModule: Module, builder: Builder) => string)
	/**
	 * 自定义最终生成的模块引用其它模块的地址的回调函数
	 * @param pathname 地址的路径
	 * @param query 地址的查询参数
	 * @param hash 地址的哈希值
	 * @param containingModule 地址所在的模块
	 * @param builder 当前的构建器对象
	 * @return 返回生成的地址
	*/
	formatURL?: (pathname: string | undefined, query: string | undefined, hash: string | undefined, containingModule: Module, builder: Builder) => string
	/**
	 * 在最终合并生成的模块开头追加的内容，如果是字符串，则其中以下标记会被替换：
	 * - `<path>`: 要生成的模块的相对路径，等价于 `<dir>/<name><ext>`
	 * - `<dir>`: 要生成的模块所在文件夹的相对路径
	 * - `<name>`: 要生成的模块的文件名（不含文件夹和扩展名部分）
	 * - `<ext>`: 要生成的模块的扩展名（含点）
	 * - `<md5>`: 要生成的模块内容的 MD5 串（小写），默认截取前 8 位，如果要截取前 n 位，使用 `<md5:n>`
	 * - `<sha1>`: 要生成的模块内容的 SHA-1 串（小写），默认截取前 8 位，如果要截取前 n 位，使用 `<sha1:n>`
	 * - `<date>`: 当前时间，默认为用户本地可读格式，如果要自定义格式，使用如 `<date:yyyyMMdd>`
	 * - `<random>`: 随机整数，默认为 8 位，如果要自定义为 n  位，使用如 `<rand:n>`
	 * - `<builder>`: 构建器的名字，默认为 `TPack`
	 * - `<version>`: 构建器的版本号
	 * @param containingModule 要生成的模块
	 * @param builder 当前的构建器对象
	 * @example "/* This file is generated by <builder>. DO NOT EDIT DIRECTLY!! *‌/"
	 */
	prepend?: string | ((containingModule: Module, builder: Builder) => string)
	/**
	 * 在最终合并生成的模块末尾追加的内容，如果是字符串，则其中以下标记会被替换：
	 * - `<path>`: 要生成的模块的相对路径，等价于 `<dir>/<name><ext>`
	 * - `<dir>`: 要生成的模块所在文件夹的相对路径
	 * - `<name>`: 要生成的模块的文件名（不含文件夹和扩展名部分）
	 * - `<ext>`: 要生成的模块的扩展名（含点）
	 * - `<md5>`: 要生成的模块内容的 MD5 串（小写），默认截取前 8 位，如果要截取前 n 位，使用 `<md5:n>`
	 * - `<sha1>`: 要生成的模块内容的 SHA-1 串（小写），默认截取前 8 位，如果要截取前 n 位，使用 `<sha1:n>`
	 * - `<date>`: 当前时间，默认为用户本地可读格式，如果要自定义格式，使用如 `<date:yyyyMMdd>`
	 * - `<random>`: 随机整数，默认为 8 位，如果要自定义为 n  位，使用如 `<rand:n>`
	 * - `<builder>`: 构建器的名字，默认为 `TPack`
	 * - `<version>`: 构建器的版本号
	 * @param containingModule 要生成的模块
	 * @param builder 当前的构建器对象
	 */
	append?: string | ((containingModule: Module, builder: Builder) => string)
	/**
	 * 在每个依赖模块开头追加的内容，如果是字符串，则其中以下标记会被替换：
	 * - `<path>`: 引用的模块的相对路径，等价于 `<dir>/<name><ext>`
	 * - `<dir>`: 引用的模块所在文件夹的相对路径
	 * - `<name>`: 引用的模块的文件名（不含文件夹和扩展名部分）
	 * - `<ext>`: 引用的模块的扩展名（含点）
	 * - `<md5>`: 引用的模块内容的 MD5 串（小写），默认截取前 8 位，如果要截取前 n 位，使用 `<md5:n>`
	 * - `<sha1>`: 引用的模块内容的 SHA-1 串（小写），默认截取前 8 位，如果要截取前 n 位，使用 `<sha1:n>`
	 * - `<date>`: 当前时间，默认为用户本地可读格式，如果要自定义格式，使用如 `<date:yyyyMMdd>`
	 * - `<random>`: 随机整数，默认为 8 位，如果要自定义为 n  位，使用如 `<rand:n>`
	 * - `<builder>`: 构建器的名字，默认为 `TPack`
	 * - `<version>`: 构建器的版本号
	 * @param module 引用的模块
	 * @param containingModule 要生成的模块
	 * @param builder 当前的构建器对象
	 */
	modulePrepend?: string | ((module: Module, containingModule: Module, builder: Builder) => string)
	/**
	 * 在每个依赖模块末尾追加的内容，如果是字符串，则其中以下标记会被替换：
	 * - `<path>`: 引用的模块的相对路径，等价于 `<dir>/<name><ext>`
	 * - `<dir>`: 引用的模块所在文件夹的相对路径
	 * - `<name>`: 引用的模块的文件名（不含文件夹和扩展名部分）
	 * - `<ext>`: 引用的模块的扩展名（含点）
	 * - `<md5>`: 引用的模块内容的 MD5 串（小写），默认截取前 8 位，如果要截取前 n 位，使用 `<md5:n>`
	 * - `<sha1>`: 引用的模块内容的 SHA-1 串（小写），默认截取前 8 位，如果要截取前 n 位，使用 `<sha1:n>`
	 * - `<date>`: 当前时间，默认为用户本地可读格式，如果要自定义格式，使用如 `<date:yyyyMMdd>`
	 * - `<random>`: 随机整数，默认为 8 位，如果要自定义为 n  位，使用如 `<rand:n>`
	 * - `<builder>`: 构建器的名字，默认为 `TPack`
	 * - `<version>`: 构建器的版本号
	 * @param module 引用的模块
	 * @param containingModule 要生成的模块
	 * @param builder 当前的构建器对象
	 */
	moduleAppend?: string | ((module: Module, containingModule: Module, builder: Builder) => string)
	/**
	 * 在每个依赖模块之间插入的代码
	 * @default "\n\n"
	 */
	moduleSeperator?: string
	/**
	 * 生成的文件中用于缩进源码的字符串
	 * @default "\t"
	 */
	indentString?: string
	/**
	 * 生成的文件中用于换行的字符串
	 * @default "\n"
	 */
	newLine?: string
}