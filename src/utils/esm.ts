/**
 * 快速转换 ES6 模块代码到 CommonJS 模块
 * @param code 要转换的 ES6 模块代码
 * @description 出于性能考虑，本函数有以下功能限制：
 * - 不支持导出多变量（`export let a, b`/`export let [a, b]`），需逐个导出
 * - 模板字符串内出现 `import/export` 语句可能出错，可拆分成 `"imp" + "ort"`
 * - 导出操作实际在文件末尾执行，如果有循环依赖可能无法获取导出项
 */
export function transformESModuleToCommonJS(code: string) {
	let exports = ""
	code = code.replace(/"(?:[^\\"\n\r\u2028\u2029]|\\.)*"|'(?:[^\\'\n\r\u2028\u2029]|\\.)*'|`(?:[^\\\`\$]|\\.|\$\{(?:[^{]|\{[^}]*\})*?\}|\$(?!\{))*`|\/\/.*|\/\*.*?(?:\*\/|$)|\/(?:[^/\n\r\u2028\u2029]|\\.)\/|\bexport\s+(default\s+)?((?:const\b|let\b|var\b|(?:async\s*)?function\b(?:\s*\*)?|class\b)\s*)([a-zA-Z0-9_$\xAA-\uDDEF]+)|\bexport\s*(default)\b|\b(?:import\s*(?:\*\s*as\s*([a-zA-Z0-9_$\xAA-\uDDEF]+)|(\{.*?\})|([a-zA-Z0-9_$\xAA-\uDDEF]+)\s*(?:,\s*(\{.*?\}))?)\s*from|import\s*|(export)\s*\*\s*from|export\s*(\{.*?\})\s*from)\s*("(?:[^\\"\n\r\u2028\u2029]|\\.)*"|'(?:[^\\'\n\r\u2028\u2029]|\\.)*')/sg, (source, exportDefault, exportPrefix, exportName, exportExpression, importAll, importNames, importDefault, importNames2, exportAll, exportNames, fromModule) => {
		if (exportDefault || exportExpression) {
			exports += `\nObject.defineProperty(module.exports, "__esModule", { value: true });`
		}
		if (exportName) {
			exports += `\nmodule.exports.${exportDefault ? "default" : exportName} = ${exportName};`
			return `${exportPrefix}${exportName}`
		}
		if (exportExpression) {
			return `module.exports.default =`
		}
		if (fromModule) {
			if (importAll) {
				return `const ${importAll} = require(${fromModule});`
			}
			if (importNames) {
				return `const ${importNames.replace(/([a-zA-Z0-9_$\xAA-\uDDEF]\s*)\bas\b/g, "$1:")} = require(${fromModule});`
			}
			if (importDefault) {
				return `const __${importDefault} = require(${fromModule}), ${importDefault} = __${importDefault}.__esModule ? __${importDefault}.default : __${importDefault}${importNames2 ? `, ${importNames2.replace(/([a-zA-Z0-9_$\xAA-\uDDEF]\s*)\bas\b/g, "$1:")} = __${importDefault}` : ""};`
			}
			if (exportAll) {
				return `Object.assign(module.exports, require(${fromModule}));`
			}
			if (exportNames) {
				exportNames = exportNames.replace(/([a-zA-Z0-9_$\xAA-\uDDEF]\s*)\bas\b/g, "$1:")
				return `const ${exportNames} = require(${fromModule}); Object.assign(module.exports, ${exportNames});`
			}
			return `require(${fromModule});`
		}
		return source
	})
	return code + exports
}