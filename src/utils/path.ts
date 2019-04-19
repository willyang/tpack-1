import { basename, dirname, extname, isAbsolute, join, normalize, relative, resolve, sep } from "path"

/**
 * 解析指定路径对应的绝对路径
 * @param paths 要解析的路径
 * @returns 返回以 `/`(非 Windows) 或 `\`(Windows) 为分隔符的绝对路径，路径末尾多余的分隔符会被删除
 * @example resolvePath("foo/goo/hoo", "../relative")
 */
export function resolvePath(...paths: string[]) {
	return resolve(...paths)
}

/**
 * 解析指定路径对应的相对路径
 * @param base 要解析的基路径
 * @param path 要解析的路径
 * @returns 返回以 `/` 为分隔符的相对路径，路径末尾多余的分隔符会被删除
 * @example relativePath("foo/goo/hoo", "foo/goo/relative") // "../relative"
 */
export function relativePath(base: string, path: string) {
	path = relative(base, path)
	return sep === "/" ? path : path.split(sep).join("/")
}

/**
 * 规范化指定的路径格式
 * @param path 要处理的路径
 * @returns 如果路径是绝对路径，返回以 `/`(非 Windows) 或 `\`(Windows) 为分隔符的绝对路径，否则返回以 `/` 为分隔符的相对路径，路径末尾多余的分隔符会被保留
 * @example normalizePath("foo/") // "foo/"
 * @example normalizePath("./foo.js") // "foo.js"
 */
export function normalizePath(path: string) {
	path = normalize(path)
	return sep === "/" || isAbsolute(path) ? path : path.split(sep).join("/")
}

/**
 * 判断指定的路径是否是绝对路径
 * @param path 要判断的路径
 * @example isAbsolutePath("foo") // false
 */
export function isAbsolutePath(path: string) {
	return isAbsolute(path)
}

/**
 * 获取指定路径的文件夹部分
 * @param path 要处理的路径
 * @example getDir("/root/foo.txt") // "/root/"
 */
export function getDir(path: string) {
	return dirname(path)
}

/**
 * 设置指定路径的文件夹部分
 * @param path 要处理的路径
 * @param value 要设置的新文件夹路径
 * @param base 如果提供了原文件夹路径，则保留文件在原文件夹内的路径
 * @returns 如果新文件夹路径是绝对路径，返回以 `/`(非 Windows) 或 `\`(Windows) 为分隔符的绝对路径，否则返回以 `/` 为分隔符的相对路径
 * @example setDir("/root/foo.txt", "goo") // "goo/foo.txt"
 * @example setDir("/root/goo/foo.txt", "/user", "/root") // "/user/goo/foo.txt"
 */
export function setDir(path: string, value: string, base?: string) {
	if (base) {
		base = relative(base, path)
		if (isAbsolutePath(base) || base.startsWith(".." + sep)) {
			return path
		}
	} else {
		base = basename(path)
	}
	path = join(value, base)
	return sep === "/" || isAbsolutePath(path) ? path : path.split(sep).join("/")
}

/**
 * 获取指定路径的文件名部分
 * @param path 要处理的路径
 * @param includeExt 如果为 `true`（默认）则包含扩展名，否则不包含扩展名（含点）
 * @example getFileName("/root/foo.txt") // "foo.txt"
 * @example getFileName("/root/foo.txt", false) // "foo"
 */
export function getFileName(path: string, includeExt = true) {
	return basename(path, includeExt ? undefined : extname(path))
}

/**
 * 设置指定路径的文件名部分
 * @param path 要处理的路径
 * @param value 要更改的新文件名
 * @param includeExt 如果为 `true`（默认）则同时更改扩展名，否则保留原扩展名（含点）
 * @example setFileName("/root/foo.txt", "goo.jpg") // "/root/goo.jpg"
 * @example setFileName("/root/foo.txt", "goo", false) // "/root/goo.jpg"
 */
export function setFileName(path: string, value: string, includeExt = true) {
	const base = basename(path)
	return path.slice(0, path.lastIndexOf(base)) + value + (includeExt ? "" : extname(base))
}

/**
 * 在指定路径的文件名前追加内容
 * @param path 要处理的路径
 * @param value 要追加的内容
 * @example prependFileName("foo/goo.txt", "fix_") // "foo/fix_goo.txt"
 */
export function prependFileName(path: string, value: string) {
	return setFileName(path, value + getFileName(path))
}

/**
 * 在指定路径的文件名（不含扩展名部分）后追加内容
 * @param path 要处理的路径
 * @param value 要追加的内容
 * @example appendFileName("foo/goo.src.txt", "_fix") // "foo/goo_fix.src.txt"
 */
export function appendFileName(path: string, value: string) {
	const base = basename(path)
	const dot = base.indexOf(".")
	return path.slice(0, path.lastIndexOf(base)) + (dot < 0 ? base : base.substr(0, dot)) + value + (dot < 0 ? "" : base.substr(dot))
}

/**
 * 获取指定路径的扩展名（含点）部分
 * @param path 要处理的地址
 * @example getExt("/root/foo.txt") // ".txt"
 * @example getExt(".gitignore") // ""
 */
export function getExt(path: string) {
	return extname(path)
}

/**
 * 设置指定路径的扩展名（含点）部分，如果源路径不含扩展名则追加到末尾
 * @param path 要处理的路径
 * @param value 要更改的新扩展名（含点）
 * @example setExt("/root/foo.txt", ".jpg") // "/root/foo.jpg"
 * @example setExt("/root/foo.txt", "") // "/root/foo"
 * @example setExt("/root/foo", ".jpg") // "/root/foo.jpg"
 */
export function setExt(path: string, value: string) {
	return path.substr(0, path.length - extname(path).length) + value
}

/**
 * 判断当前系统是否忽略路径的大小写
 */
export const isCaseInsensitive = process.platform === "win32" || process.platform === "darwin" || process.platform === "freebsd" || process.platform === "openbsd"

/**
 * 判断两个路径的绝对路径是否相同
 * @param path1 要判断的第一个路径
 * @param path2 要判断的第二个路径
 * @param ignoreCase 是否忽略路径的大小写
 * @example pathEquals("/root", "/root") // true
 */
export function pathEquals(path1: string | undefined | null, path2: string | undefined | null, ignoreCase = isCaseInsensitive) {
	if (path1 == null || path2 == null) {
		return path1 === path2
	}
	path1 = resolve(path1)
	path2 = resolve(path2)
	if (path1.length !== path2.length) {
		return false
	}
	if (ignoreCase) {
		path1 = path1.toLowerCase()
		path2 = path2.toLowerCase()
	}
	return path1 === path2
}

/**
 * 判断指定的文件夹是否包含另一个文件或文件夹
 * @param parent 要判断的父文件夹路径
 * @param child 要判断的子文件或文件夹路径
 * @param ignoreCase 是否忽略路径的大小写
 * @example containsPath("/root", "/root/foo") // true
 * @example containsPath("/root/foo", "/root/goo") // false
 */
export function containsPath(parent: string, child: string, ignoreCase = isCaseInsensitive) {
	parent = resolve(parent)
	child = resolve(child)
	if (child.length < parent.length) {
		return false
	}
	if (ignoreCase) {
		parent = parent.toLowerCase()
		child = child.toLowerCase()
	}
	if (child.length === parent.length) {
		return child === parent
	}
	if (parent.charAt(parent.length - 1) !== sep) {
		parent += sep
	}
	return child.startsWith(parent)
}

/**
 * 获取两个路径中最深的路径
 * @param path1 要处理的第一个路径
 * @param path2 要处理的第二个路径
 * @param ignoreCase 是否忽略路径的大小写
 * @returns 返回 `path1` 或 `path2`，如果没有公共部分则返回空
 */
export function deepestPath(path1: string | null, path2: string | null, ignoreCase = isCaseInsensitive) {
	if (path1 == null || path2 == null) {
		return null
	}
	if (containsPath(path1, path2, ignoreCase)) {
		return path2
	}
	if (containsPath(path2, path1, ignoreCase)) {
		return path1
	}
	return null
}

/**
 * 获取两个路径的公共文件夹
 * @param path1 要处理的第一个路径
 * @param path2 要处理的第二个路径
 * @param ignoreCase 是否忽略路径的大小写
 * @returns 返回以 `/`(非 Windows) 或 `\`(Windows) 为分隔符的绝对路径，如果没有公共部分则返回空
 * @example commonDir("/root/foo", "/root/foo/goo") // "/root/foo"
 */
export function commonDir(path1: string | null, path2: string | null, ignoreCase = isCaseInsensitive) {
	if (path1 == null || path2 == null) {
		return null
	}
	path1 = resolve(path1)
	path2 = resolve(path2)
	// 确保 path1.length <= path2.length
	if (path1.length > path2.length) {
		[path1, path2] = [path2, path1]
	}
	// 计算相同的开头部分，以分隔符为界
	let index = -1
	let i = 0
	const sepCode = sep.charCodeAt(0)
	for (; i < path1.length; i++) {
		let ch1 = path1.charCodeAt(i)
		let ch2 = path2.charCodeAt(i)
		// 如果不区分大小写则将 ch1 和 ch2 全部转小写
		if (ignoreCase) {
			if (ch1 >= 65 /*A*/ && ch1 <= 90/*Z*/) {
				ch1 |= 0x20
			}
			if (ch2 >= 65 /*A*/ && ch2 <= 90/*Z*/) {
				ch2 |= 0x20
			}
		}
		// 发现不同字符后终止
		if (ch1 !== ch2) {
			break
		}
		// 如果发现一个分隔符，则标记之前的内容是公共部分
		if (ch1 === sepCode) {
			index = i
		}
	}
	// 特殊处理：path1 = "foo", path2 = "foo" 或 "foo/goo"
	if (i === path1.length && (i === path2.length || path2.charCodeAt(i) === sepCode)) {
		return path1
	}
	return index < 0 ? null : path1.substr(0, index)
}