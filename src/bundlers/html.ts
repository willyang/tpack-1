import { Module } from "../core/module"
import { Builder, Bundler } from "../core/builder"
import { decode as decodeHTML } from "ent"

//tags: {
//	[tagName: string]: {
//		[propName: string]: ""
//	}
//}

/** 表示一个 HTML 模块打包器 */
export class HTMLBundler implements Bundler {

	constructor(builder: Builder) {

	}

	parse(module: Module) {
		module.content.replace(/<!--(.*?)(?:-->|$)|<!\[CDATA\[.*?(?:\]\]>|$)|<%.*?(?:%>|$)|<\?.*?(?:\?>|$)|(<script\b(?:'[^']*'|"[^"]*"|[^>])*>)(.*?)(?:<\/script(?:'[^']*'|"[^"]*"|[^>])*>|$)|(<style\b(?:'[^']*'|"[^"]*"|[^>])*>)(.*?)(?:<\/style(?:'[^']*'|"[^"]*"|[^>])*>|$)|<([^\s'"]+)\b(?:'[^']*'|"[^"]*"|[^>])*>/igs, (source: string, comment: string | undefined, openScript: string | undefined, script: string | undefined, openStyle: string | undefined, style: string | undefined, tagName: string | undefined, index: number) => {
			// <img>, <link>, ...
			if (tagName !== undefined) {
				this.parseTag(source, tagName, index)
				return ""
			}
			// <!-- -->
			if (comment !== undefined) {
				this.parseComment(source, comment, index)
				return ""
			}
			// <script>
			if (openScript !== undefined) {
				this.parseScriptTag(openScript, script!, index)
				return ""
			}
			// <style>
			if (openStyle !== undefined) {
				this.parseScriptTag(openStyle, style!, index)
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
	readonly serverCode: RegExp // /<[%\?]|[%\?]>|@\(/

	/**
	 * 解析一个 HTML 标签
	 * @param openTag 要解析的打开标签源码
	 * @param tagName 要解析的标签名
	 * @param index 打开标签在源文件的起始位置（从 0 开始）
	 */
	protected parseTag(openTag: string, tagName: string, index: number) {
		// 判断是否禁止解析当前标签
		const tagInfo = this.tags.get(tagName.toLowerCase()) || this.defaultTag
		if (!tagInfo.size) {
			return
		}

		// 解析属性。
		let skipInnerHTML: boolean | undefined;
		let langAttr: { source: string; sourceIndex: number; value: string; ext: string } | undefined;
		openTag.replace(/\s*([^\s='"]+)\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]*)/g, (attr: string, attrName: string, attrString: string, doubleString: string | undefined, singleString: string | undefined, attrIndex: number) => {
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
			const attrValueIndex = attrIndex + attrIndex + attr.length - attrString.length + (attrValue.length === attrString.length ? 0 : 1)
			const value = decodeHTML(attrValue)
			// 处理属性
			switch (attrType) {
				case AttrType.url:
					this.parseUrl(attrValue, attrValueIndex, value, "html.tag", url => formatAttrValue(url, attrString));
					break;
				case AttrType.script:
					this.parseContent(attrValue, attrValueIndex, value, ".js", content => formatAttrValue(content, attrString));
					break;
				case AttrType.style:
					this.parseContent(attrValue, attrValueIndex, value, ".css", content => formatAttrValue(content, attrString));
					break;
				case AttrType.scriptURL:
					skipInnerHTML = true;
					this.parseUrl(attrValue, attrValueIndex, value, "html.tag", url => formatAttrValue(url, attrString), urlInfo => {
						// 删除 "lang=..."
						if (langAttr && langAttr.value !== "text/javascript" && /\.js$/i.test(urlInfo.module!.destPath!)) {
							this.addChange(langAttr.source, langAttr.sourceIndex, "");
						}
						// 删除 "src=..."
						this.addChange(attr, sourceIndex + attrIndex, "");
						// ">" => ">..."
						this.addChange("", sourceIndex + attr.length, savePath => urlInfo.module!.getContent(savePath));
					});
					break;
				case AttrType.styleURL:
					skipInnerHTML = true;
					this.parseUrl(attrValue, attrValueIndex, value, "html.tag", url => formatAttrValue(url, attrString), urlInfo => {
						// 删除 "lang=..."
						if (langAttr && langAttr.value !== "text/css" && /\.css$/i.test(urlInfo.module!.destPath!)) {
							this.addChange(langAttr.source, langAttr.sourceIndex, "");
						}
						if (tagName === "link") {
							const rel = this.getAttr(attr, sourceIndex, "rel");
							if (rel && rel.value === "stylesheet") {
								// "<link" => "<style"
								this.addChange(tagName, sourceIndex + "<".length, "style");
								// 删除 "rel=..."
								this.addChange(rel.source, rel.sourceIndex, "");
								// 删除 "href=..."
								this.addChange(attr, sourceIndex + attrIndex, "");
								// "/>" => ">...</style>"
								const end = /\s*\/?>$/.exec(attr)!;
								this.addChange(end[0], sourceIndex + end.index, savePath => ">" + urlInfo.module!.getContent(savePath) + "</style>");
							} else {
								this.addChange(attrValue, attrValueIndex, savePath => formatAttrValue(urlInfo.module!.getBase64Uri(savePath), attrString));
							}
						} else {
							// 删除 "href=..."
							this.addChange(attr, sourceIndex + attrIndex, "");
							// ">" => ">..."
							this.addChange("", sourceIndex + attr.length, savePath => urlInfo.module!.getContent(savePath));
						}
					});
					break;
				case AttrType.lang:
					langAttr = {
						source: attr,
						sourceIndex: sourceIndex + attrIndex,
						value: value,
						ext: this.getExtOfLang(value)
					};
					break;
				case AttrType.urlSet:
					// http://www.webkit.org/demos/srcset/
					// <img src="image-src.png" srcset="image-1x.png 1x, image-2x.png 2x, image-3x.png 3x, image-4x.png 4x">
					attrValue.replace(/((?:^|,)\s*)(.*?)\s+\dx/g, (matchSource: string, prefix: string, url: string, matchIndex: number) => {
						this.parseUrl(url, attrValueIndex + matchIndex + prefix.length, this.decodeHTML(url), "html.tag", url => formatAttrValue(url, attrString));
						return "";
					});
					break;
			}
			return "";
		});

		// 解析内联内容。
		if (innerHTML != undefined && !skipInnerHTML && this.attrType(source, sourceIndex, tagName, "innerHTML")) {
			this.parseContent(innerHTML, innerHTMLIndex!, innerHTML, langAttr ? langAttr.ext : this.getExtOfLang(tagName), content => content.replace(/<\/(script|style)>/g, "<\\u002f$1>"), module => {
				if (langAttr && langAttr.value !== (tagName === "style" ? "text/css" : "text/javascript") && (tagName === "style" ? /\.js$/i : /\.css$/i).test(module.destPath!)) {
					// 删除 "lang=..."
					this.addChange(langAttr.source, langAttr.sourceIndex, "");
				}
			});
		}

	}

	/**
	 * 解析一个 `<script>` 标签
	 * @param openTag 要解析的打开标签源码
	 * @param content 要解析的标签内容
	 * @param index 打开标签在源文件的起始位置（从 0 开始）
	 */
	protected parseScriptTag(openTag: string, content: string, index: number) {

	}

	/**
	 * 解析一个 `<style>` 标签
	 * @param openTag 要解析的打开标签源码
	 * @param content 要解析的标签内容
	 * @param index 打开标签在源文件的起始位置（从 0 开始）
	 */
	protected parseStyleTag(openTag: string, content: string, index: number) {

	}

	/**
	 * 解析一个 HTML 注释
	 * @param comment 要解析的片段源码
	 * @param content 要解析的标签内容
	 * @param index 打开标签在源文件的起始位置（从 0 开始）
	 */
	protected parseComment(comment: string, content: string, index: number) {

	}

	generate(module: Module, builder: Builder) {

	}

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

export interface HTMLBundlerOptions {



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

///**
// * 表示一个 HTML 模块。
// */
//export class HtmlModule extends TextModule {

//    /**
//     * 获取当前模块的解析选项。
//     */
//	options: HtmlModuleOptions;

//    /**
//     * 解析一个 `<tag ...>` 片段。
//     * @param source 要解析的 `<tag ...>` 片段。
//     * @param sourceIndex *source* 在源文件的起始位置。
//     * @param tagName 解析的标签名。
//     * @param innerHTML 标签的内容部分。仅当标签为 "script" 或 "style" 时存在。
//     * @param innerHTMLIndex *innerHTML* 在源文件的起始位置。
//     */
//	protected parseTag(source: string, sourceIndex: number, tagName: string, innerHTML?: string, innerHTMLIndex?: number) {

//	}

//    /**
//     * 判断是否允许解析指定的标签。
//     * @param file 要解析的源文件。
//     * @param options 解析的选项。
//     * @param tagName 要解析的标签名。
//     * @return 如果允许则返回 true，否则返回 false。
//     */
//	protected canParseTag(tagName: string) {
//		const tagsOption = this.options.tags;
//		if (tagsOption === false) {
//			return false;
//		}
//		if (typeof tagsOption === "object" && (tagsOption[tagName] === false || tagsOption["*"] === false)) {
//			return false;
//		}
//		return true;
//	}

//    /**
//     * 判断指定的属性的解析方式。
//     * @param file 要解析的源文件。
//     * @param options 解析的选项。
//     * @param source 相关的代码片段。
//     * @param sourceIndex *source* 在源文件的起始位置。
//     * @param tagName 要解析的标签名。
//     * @param attrName 要解析的属性名。
//     * @return 返回解析类型。
//     */
//	protected attrType(source: string, sourceIndex: number, tagName: string, attrName: string) {
//		let result: AttrType;
//		const tagsOption = this.options.tags;
//		if (typeof tagsOption === "object") {
//			if (typeof tagsOption[tagName] === "object") {
//				result = (tagsOption[tagName] as any)[attrName];
//			}
//			if (result == undefined && typeof tagsOption["*"] === "object") {
//				result = (tagsOption["*"] as any)[attrName];
//			}
//		} else if (typeof tagsOption === "function") {
//			result = tagsOption(tagName, attrName, source, sourceIndex, this);
//		}
//		if (result == undefined || result === true) {
//			result = defaultTags[tagName] && defaultTags[tagName][attrName] || defaultTags["*"][attrName];
//		}
//		return result;
//	}

//    /**
//     * 获取指定语言的扩展名。
//     * @param file 要解析的源文件。
//     * @param options 解析的选项。
//     * @param lang 要获取的语言名或 MIME 类型或标签名。
//     * @return 返回扩展名。
//     */
//	protected getExtOfLang(lang: string) {
//		return this.options.langs && this.options.langs[lang] || defaultLangs[lang] || this.packer.getExtByMimeType(lang) || lang.replace(/\^.*\//, "");
//	}

//    /**
//     * 获取指定属性的信息。
//     * @param openTag 相关的代码片段。
//     * @param openTagIndex *openTag* 在源文件的起始位置。
//     * @param attrName 要解析的属性名。
//     */
//	protected getAttr(openTag: string, openTagIndex: number, attrName: string) {
//		const match = new RegExp("(\\s" + attrName + ')(?:(\\s*=\\s*)("([^"]*)"|\'([^\']*)\'|[^\\s>]*))?', "i").exec(openTag);
//		if (match) {
//			return {
//				source: match[0],
//				sourceIndex: openTagIndex + match.index,
//				value: this.decodeHTML(match[4] != undefined ? match[4] : match[5] != undefined ? match[5] : match[3])
//			};
//		}
//	}

//    /**
//     * 当被子类重写时负责将当前模块的内容写入到指定的写入器。
//     * @param writer 要写入的目标写入器。
//     * @param savePath 要保存的目标路径。
//     * @param modules 依赖的所有模块。
//     * @param extracts 导出的所有文件。
//     */
//	write(writer: digo.Writer, savePath: string, modules: Module[], extracts: digo.File[]) {
//		super.writeModule(writer, this, savePath, modules, extracts);
//	}

//}

///**
// * 表示解析 HTML 模块的选项。
// */
//export interface HtmlModuleOptions extends TextModuleOptions {

//    /**
//     * 设置 HTML 标签的解析方式。
//     * @example
//     * #### 不解析所有标签
//     * ```json
//     * {
//     *      tags: false
//     * }
//     * ```
//     * #### 不解析特定标签
//     * ```json
//     * {
//     *      tags: {
//     *          "img": false,
//     *          "canvas": false
//     *      }
//     * }
//     * ```
//     * #### 分别设置每个属性的解析方式
//     * ```json
//     * {
//     *      tags: {
//     *          "img": {
//     *              "src": false        // 不解析 <img src>
//     *              "onpaint": "script" // 将 <img onpaint> 解析为内联的脚本
//     *              "theme": "style"    // 将 <img theme> 解析为内联的样式
//     *              "href": "url"       // 将 <img href> 解析为内联的地址
//     *          },
//     *          "*": {                  // * 将对所有节点生效
//     *              "style": false
//     *          }
//     *      }
//     * }
//     * ```
//     * #### 自定义函数
//     * ```json
//     * {
//     *      tags: function (tagName, attrName, openTag, openTagIndex, module) {
//     *          return "url";
//     *      }
//     * }
//     * ```
//     */
//	tags?: boolean | { [tagName: string]: boolean | { [attrName: string]: AttrType } } | ((tagName: string, attrName: string, openTag: string, openTagIndex: number, module: Module) => AttrType);

//    /**
//     * 设置各语言的映射扩展名。
//     */
//	langs?: { [type: string]: string };

//    /**
//     * 测试是否包含服务端代码的正则表达式。
//     */
//	serverCode?: RegExp;

//}

///**
// * 表示属性的解析方式。
// */
//export type AttrType = void | boolean | "url" | "urlset" | "style" | "script" | "lang" | "script-url" | "style-url";

//const defaultTags: { [tagName: string]: { [propName: string]: AttrType } } = {
//	"*": {
//		"src": "url",
//		"data-src": "url",
//		"href": "url",
//		"style": "style",
//		"onabort": "script",
//		"onafterprint": "script",
//		"onbeforeprint": "script",
//		"onbeforeunload": "script",
//		"onblur": "script",
//		"oncanplay": "script",
//		"oncanplaythrough": "script",
//		"onchange": "script",
//		"onclick": "script",
//		"oncompassneedscalibration": "script",
//		"oncontextmenu": "script",
//		"ondblclick": "script",
//		"ondevicelight": "script",
//		"ondevicemotion": "script",
//		"ondeviceorientation": "script",
//		"ondrag": "script",
//		"ondragend": "script",
//		"ondragenter": "script",
//		"ondragleave": "script",
//		"ondragover": "script",
//		"ondragstart": "script",
//		"ondrop": "script",
//		"ondurationchange": "script",
//		"onemptied": "script",
//		"onended": "script",
//		"onerror": "script",
//		"onfocus": "script",
//		"onhashchange": "script",
//		"oninput": "script",
//		"oninvalid": "script",
//		"onkeydown": "script",
//		"onkeypress": "script",
//		"onkeyup": "script",
//		"onload": "script",
//		"onloadeddata": "script",
//		"onloadedmetadata": "script",
//		"onloadstart": "script",
//		"onmessage": "script",
//		"onmousedown": "script",
//		"onmouseenter": "script",
//		"onmouseleave": "script",
//		"onmousemove": "script",
//		"onmouseout": "script",
//		"onmouseover": "script",
//		"onmouseup": "script",
//		"onmousewheel": "script",
//		"onmsgesturechange": "script",
//		"onmsgesturedoubletap": "script",
//		"onmsgestureend": "script",
//		"onmsgesturehold": "script",
//		"onmsgesturestart": "script",
//		"onmsgesturetap": "script",
//		"onmsinertiastart": "script",
//		"onmspointercancel": "script",
//		"onmspointerdown": "script",
//		"onmspointerenter": "script",
//		"onmspointerleave": "script",
//		"onmspointermove": "script",
//		"onmspointerout": "script",
//		"onmspointerover": "script",
//		"onmspointerup": "script",
//		"onoffline": "script",
//		"ononline": "script",
//		"onorientationchange": "script",
//		"onpagehide": "script",
//		"onpageshow": "script",
//		"onpause": "script",
//		"onplay": "script",
//		"onplaying": "script",
//		"onpopstate": "script",
//		"onprogress": "script",
//		"onratechange": "script",
//		"onreadystatechange": "script",
//		"onreset": "script",
//		"onresize": "script",
//		"onscroll": "script",
//		"onseeked": "script",
//		"onseeking": "script",
//		"onselect": "script",
//		"onstalled": "script",
//		"onstorage": "script",
//		"onsubmit": "script",
//		"onsuspend": "script",
//		"ontimeupdate": "script",
//		"ontouchcancel": "script",
//		"ontouchend": "script",
//		"ontouchmove": "script",
//		"ontouchstart": "script",
//		"onunload": "script",
//		"onvolumechange": "script",
//		"onwaiting": "script"
//	},
//	"script": {
//		"innerHTML": "script",
//		"src": "script-url",
//		"type": "lang",
//		"lang": "lang",
//		"language": "lang"
//	},
//	"link": {
//		"href": "style-url",
//		"type": "lang",
//		"lang": "lang",
//		"language": "lang"
//	},
//	"style": {
//		"innerHTML": "style",
//		"src": "style-url",
//		"type": "lang",
//		"lang": "lang",
//		"language": "lang"
//	},
//	"img": {
//		"srcset": "urlset",
//	},
//	"form": {
//		"action": "url",
//	},
//	"input": {
//		"formaction": "url",
//	},
//	"button": {
//		"formaction": "url",
//	},
//	"object": {
//		"data": "url",
//	},
//};

//const defaultLangs: { [mimeType: string]: string } = {
//	"script": ".js",
//	"style": ".css",
//	"template": ".inc",
//	"text/javascript": ".js",
//	"text/style": ".css",
//	"text/plain": ".txt",
//	"text/template": ".inc"
//};