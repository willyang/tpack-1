import { copyToMap } from "../utils/misc"

/** 表示一个本地化服务 */
export class LocaleService {

	/** 当前的区域代码 */
	private _currentLocale!: string

	/** 获取或设置当前的区域代码 */
	get currentLocale() {
		return this._currentLocale
	}
	set currentLocale(value) {
		this._currentLocale = value
		this.dict.clear()
		// 忽略字典不存在的错误
		if (value !== "en-US") {
			try {
				copyToMap(require(`../../locales/${value}.json`), this.dict)
			} catch  { }
		}
	}

	/**
	 * 初始化新的本地化服务
	 * @param locale 初始区域代码
	 */
	constructor(locale: string) {
		this.currentLocale = locale
	}

	/** 获取当前本地语言的翻译字典 */
	readonly dict = new Map<string, string>()

	/**
	 * 获取指定信息的本地化翻译版本
	 * @param message 要翻译的消息
	 * @returns 如果存在本地化翻译则返回翻译结果，否则返回原文
	 */
	translate(message: string) {
		return this.dict.get(message) || message
	}

	/** 
	 * 获取模板字符串的本地化翻译版本
	 * @param strings 常量部分
	 * @param values 变量部分
	 * @returns 返回拼接的内容，如果存在本地化翻译则返回翻译结果，否则返回原文
	 */
	i18n(strings: TemplateStringsArray, ...values: any[]) {
		const message = strings.reduce((x, y, index) => `${x}{${index - 1}}${y}`)
		const translated = this.dict.get(message)
		if (translated) {
			return translated.replace(/\{(\d+)\}/g, (_, index) => values[index] || "")
		}
		return strings.reduce((x, y, index) => `${x}${values[index - 1] || ""}${y}`)
	}

}

/** 获取全局的语言服务对象 */
export const service = new LocaleService(getDefaultLocale())

/** 获取模板字符串的本地化翻译版本 */
export const i18n = service.i18n.bind(service)

/**
 * 获取当前操作系统的默认区域代码
 * @returns 返回格式如 "en-US"
 */
export function getDefaultLocale(): string {
	const env = process.env || {}
	const locale = env.LC_ALL || env.LC_MESSAGES || env.LANG || env.LANGUAGE
	if (locale) {
		return locale.replace(/^(\w+)[-_](\w+).*$/s, "$1-$2")
	}
	// 为保证安装包小巧，不强制依赖 os-locale
	try {
		return require("os-locale").sync().replace("_", "-")
	} catch { }
	return "en-US"
}