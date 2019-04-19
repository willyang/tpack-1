import { Builder, Bundler as IBundler } from "../core/builder"
import { Module } from "../core/module"
import { encode as encodeHTML, decode as decodeHTML } from "ent"
import { Bundler, TextDocument, OutputOptions } from "./common"

/** 表示一个 HTML 模块打包器 */
export class HTMLBundler extends Bundler implements IBundler {

	get type() { return "text/html" }

	constructor(options: HTMLBundlerOptions = {}, builder: Builder) {
		super(options, builder)
		this.serverCode = options.serverCode || /<[%\?]|[%\?]>|@\(/
		this.js = options.js || ".js"
		this.css = options.css || ".css"
		this.include = options.include !== false

		loadTags(require("../../data/tags.json"), this.tags, this.defaultTag)
		loadTags(options.tags, this.tags, this.defaultTag)

		function loadTags(src: HTMLBundlerOptions["tags"], dest: HTMLBundler["tags"], defaultTag: HTMLBundler["defaultTag"]) {
			for (const tagName in src) {
				const attrs = src[tagName]
				let map = tagName === "*" ? defaultTag : dest.get(tagName)
				if (!map) {
					dest.set(tagName, map = new Map())
				}
				if (attrs === false) {
					map.clear()
					continue
				}
				for (const attrName in attrs) {
					const attrType = attrs[attrName]
					if (attrType === false) {
						map.delete(attrName)
					} else {
						// @ts-ignore
						map.set(attrName, typeof attrType === "string" ? AttrType[attrType] : attrType)
					}
				}
			}
		}
	}

	parseContent(content: string, document: TextDocument, module: Module) {
		content.replace(/<!--(.*?)(?:-->|$)|<!\[CDATA\[.*?(?:\]\]>|$)|<%.*?(?:%>|$)|<\?.*?(?:\?>|$)|(<script\b(?:'[^']*'|"[^"]*"|[^>])*>)(.*?)(?:<\/script(?:'[^']*'|"[^"]*"|[^>])*>|$)|(<style\b(?:'[^']*'|"[^"]*"|[^>])*>)(.*?)(?:<\/style(?:'[^']*'|"[^"]*"|[^>])*>|$)|<([^\s'"]+)\b(?:'[^']*'|"[^"]*"|[^>])*>/igs, (source: string, comment: string | undefined, openScript: string | undefined, script: string | undefined, openStyle: string | undefined, style: string | undefined, tagName: string | undefined, index: number) => {
			// <img>, <link>, ...
			if (tagName !== undefined) {
				this.parseTag(source, tagName, index, document, module)
				return ""
			}
			// <!-- -->
			if (comment !== undefined) {
				this.parseComment(source, comment, index, document, module)
				return ""
			}
			// <script>
			if (openScript !== undefined) {
				this.parseScriptTag(openScript, script!, index, document, module)
				return ""
			}
			// <style>
			if (openStyle !== undefined) {
				this.parseScriptTag(openStyle, style!, index, document, module)
				return ""
			}
			return ""
		})
	}

	/** 获取各标签的处理方式 */
	readonly tags = new Map<string, Map<string, AttrType>>()

	/** 获取各属性的全局处理方式 */
	readonly defaultTag = new Map<string, AttrType>()

	/** 匹配服务器代码的正则表达式 */
	readonly serverCode: RegExp

	/** JS 代码默认语言 */
	readonly js: string

	/** CSS 代码默认语言 */
	readonly css: string

	/**
	 * 解析一个 HTML 标签
	 * @param openTag 要解析的打开标签源码
	 * @param tagName 要解析的标签名
	 * @param index 打开标签在源文件的起始位置（从 0 开始）
	 */
	protected parseTag(openTag: string, tagName: string, index: number, document: TextDocument, module: Module) {
		// 判断是否禁止解析当前标签
		const tagInfo = this.tags.get(tagName.toLowerCase()) || this.defaultTag
		if (!tagInfo.size) {
			return
		}
		// 解析属性
		let skipInnerHTML: boolean | undefined
		let langAttr: { source: string; sourceIndex: number; value: string; ext: string } | undefined
		openTag.replace(/\s*([^\s='"]+)\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]*)/g, (attrSource: string, attrName: string, attrString: string, doubleString: string | undefined, singleString: string | undefined, attrIndex: number) => {
			// 不处理含服务端代码的属性
			if (this.serverCode.test(attrString)) {
				return ""
			}
			// 判断解析当前属性的配置
			const attrKey = attrName.toLowerCase()
			let attrType = tagInfo.get(attrKey)
			if (attrType === undefined && tagInfo !== this.defaultTag) attrType = this.defaultTag.get(attrKey)
			if (!attrType) {
				return ""
			}
			// 计算属性值
			const attrValue = doubleString != undefined ? doubleString : singleString != undefined ? singleString : attrString
			const attrValueIndex = index + attrIndex + attrSource.length - attrString.length + (attrValue.length === attrString.length ? 0 : 1)
			const value = decodeHTML(attrValue)
			// 处理属性
			switch (attrType) {
				case AttrType.url:
					this.parseURL(value, "html.tag", attrValueIndex, attrValueIndex + attrValue.length, document, module, url => formatAttrValue(url, attrString))
					break
				case AttrType.script:
					this.parseSubmodule(value, this.js, attrValueIndex, attrValueIndex + attrValue.length, document, module, content => formatAttrValue(content, attrString))
					break
				case AttrType.style:
					this.parseSubmodule(value, this.css, attrValueIndex, attrValueIndex + attrValue.length, document, module, content => formatAttrValue(content, attrString))
					break
				// case AttrType.scriptURL:
				// 	skipInnerHTML = true
				// 	this.parseUrl(attrValue, attrValueIndex, value, "html.tag", url => formatAttrValue(url, attrString), urlInfo => {
				// 		// 删除 "lang=..."
				// 		if (langAttr && langAttr.value !== "text/javascript" && /\.js$/i.test(urlInfo.module!.destPath!)) {
				// 			this.addChange(langAttr.source, langAttr.sourceIndex, "")
				// 		}
				// 		// 删除 "src=..."
				// 		this.addChange(attr, sourceIndex + attrIndex, "")
				// 		// ">" => ">..."
				// 		this.addChange("", sourceIndex + attr.length, savePath => urlInfo.module!.getContent(savePath))
				// 	})
				// 	break
				// case AttrType.styleURL:
				// 	skipInnerHTML = true
				// 	this.parseUrl(attrValue, attrValueIndex, value, "html.tag", url => formatAttrValue(url, attrString), urlInfo => {
				// 		// 删除 "lang=..."
				// 		if (langAttr && langAttr.value !== "text/css" && /\.css$/i.test(urlInfo.module!.destPath!)) {
				// 			this.addChange(langAttr.source, langAttr.sourceIndex, "")
				// 		}
				// 		if (tagName === "link") {
				// 			const rel = this.getAttr(attr, sourceIndex, "rel")
				// 			if (rel && rel.value === "stylesheet") {
				// 				// "<link" => "<style"
				// 				this.addChange(tagName, sourceIndex + "<".length, "style")
				// 				// 删除 "rel=..."
				// 				this.addChange(rel.source, rel.sourceIndex, "")
				// 				// 删除 "href=..."
				// 				this.addChange(attr, sourceIndex + attrIndex, "")
				// 				// "/>" => ">...</style>"
				// 				const end = /\s*\/?>$/.exec(attr)!
				// 				this.addChange(end[0], sourceIndex + end.index, savePath => ">" + urlInfo.module!.getContent(savePath) + "</style>")
				// 			} else {
				// 				this.addChange(attrValue, attrValueIndex, savePath => formatAttrValue(urlInfo.module!.getBase64Uri(savePath), attrString))
				// 			}
				// 		} else {
				// 			// 删除 "href=..."
				// 			this.addChange(attr, sourceIndex + attrIndex, "")
				// 			// ">" => ">..."
				// 			this.addChange("", sourceIndex + attr.length, savePath => urlInfo.module!.getContent(savePath))
				// 		}
				// 	})
				// 	break
				// case AttrType.lang:
				// 	langAttr = {
				// 		source: attr,
				// 		sourceIndex: sourceIndex + attrIndex,
				// 		value: value,
				// 		ext: this.getExtOfLang(value)
				// 	}
				// 	break
				// case AttrType.urlSet:
				// 	// http://www.webkit.org/demos/srcset/
				// 	// <img src="image-src.png" srcset="image-1x.png 1x, image-2x.png 2x, image-3x.png 3x, image-4x.png 4x">
				// 	attrValue.replace(/((?:^|,)\s*)(.*?)\s+\dx/g, (matchSource: string, prefix: string, url: string, matchIndex: number) => {
				// 		const startIndex = attrValueIndex + matchIndex + prefix.length
				// 		this.parseURL(decodeHTML(url), "html.tag", startIndex, startIndex + url.length, document, module, url => formatAttrValue(url, attrString))
				// 		return ""
				// 	})
				// 	break
			}
			return ""
		})
		// // 解析内联内容
		// if (innerHTML != undefined && !skipInnerHTML && this.attrType(source, sourceIndex, tagName, "innerHTML")) {
		// 	this.parseContent(innerHTML, innerHTMLIndex!, innerHTML, langAttr ? langAttr.ext : this.getExtOfLang(tagName), content => content.replace(/<\/(script|style)>/g, "<\\u002f$1>"), module => {
		// 		if (langAttr && langAttr.value !== (tagName === "style" ? "text/css" : "text/javascript") && (tagName === "style" ? /\.js$/i : /\.css$/i).test(module.destPath!)) {
		// 			// 删除 "lang=..."
		// 			this.addChange(langAttr.source, langAttr.sourceIndex, "")
		// 		}
		// 	})
		// }
	}

	/**
	 * 解析一个 `<script>` 标签
	 * @param openTag 要解析的打开标签源码
	 * @param content 要解析的标签内容
	 * @param index 打开标签在源文件的起始位置（从 0 开始）
	 */
	protected parseScriptTag(openTag: string, content: string, index: number, document: TextDocument, module: Module) {

	}

	/**
	 * 解析一个 `<style>` 标签
	 * @param openTag 要解析的打开标签源码
	 * @param content 要解析的标签内容
	 * @param index 打开标签在源文件的起始位置（从 0 开始）
	 */
	protected parseStyleTag(openTag: string, content: string, index: number, document: TextDocument, module: Module) {

	}

	/** 判断是否解析 <!-- #include --> */
	readonly include: boolean

	/**
	 * 解析一个 HTML 注释
	 * @param comment 要解析的片段源码
	 * @param content 要解析的标签内容
	 * @param index 打开标签在源文件的起始位置（从 0 开始）
	 */
	protected parseComment(comment: string, content: string, index: number, document: TextDocument, module: Module) {

	}

}

/** 表示 HTML 模块打包器的选项 */
export interface HTMLBundlerOptions extends OutputOptions {
	tags?: { [tagName: string]: { [attrName: string]: keyof typeof AttrType | AttrType | false } | false }
	/**
	 * 是否解析 <!-- #include -->
	 * @default true
	 */
	include?: boolean
	js?: ".tsx", // JS 代码默认语言
	css?: ".less" // CSS 代码默认语言
	serverCode?: RegExp
}

/** 表示属性类型 */
export const enum AttrType {
	/** 普通文本 */
	plainText,
	/** 属性值是一个链接 */
	url,
	/** 属性值是一个链接集合 */
	urlSet,
	/** 属性值是一段脚本 */
	script,
	/** 属性值是一个脚本地址 */
	scriptURL,
	/** 属性值是一段样式 */
	style,
	/** 属性值是一个样式地址 */
	styleURL,
	/** 属性值是一个语言标识 */
	lang,
}

/**
 * 生成属性值字符串
 * @param value 属性值
 * @param quote 优先使用的引号
 * @return 返回已格式化的属性字符串
 */
export function formatAttrValue(value: string, quote: string): string {
	switch (quote.charCodeAt(0)) {
		case 34 /*"*/:
			return value.replace(/"/g, "&quot;")
		case 39 /*'*/:
			return value.replace(/'/g, "&#39;")
		default:
			return /[>\s="']/.test(value) ? '"' + formatAttrValue(value, '"') + '"' : value
	}
}