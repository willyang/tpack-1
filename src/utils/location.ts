/** 表示一个行列位置 */
export interface Location {

	/** 行号（从 0 开始）*/
	line: number

	/** 列号（从 0 开始）*/
	column: number

}

/**
 * 计算指定索引对应的行列号，如果索引错误则返回最近的位置
 * @param value 要处理的字符串
 * @param index 要计算的索引
 * @param cache 如果提供一个缓存数组则存放一个索引数据以加速检索
 */
export function indexToLocation(value: string, index: number, cache?: number[] & { index?: number }) {
	if (index > 0) {
		cache = buildIndex(value, cache, index)
		let cursor = cache.index!
		while (cache[cursor] <= index) {
			cursor++
		}
		while (cursor >= cache.length || cache[cursor] > index) {
			cursor--
		}
		cache.index = cursor
		return { line: cursor, column: index - cache[cursor] } as Location
	}
	return { line: 0, column: 0 } as Location
}

/**
 * 计算指定行列号对应的索引，如果行列号错误则返回最近的索引
 * @param value 要处理的字符串
 * @param location 要计算的行列号
 * @param cache 如果提供一个缓存数组则存放一个索引数据以加速检索
 */
export function locationToIndex(value: string, location: Location, cache?: number[] & { index?: number }) {
	if (location.line < 0) {
		return 0
	}
	cache = buildIndex(value, cache, undefined, location.line)
	if (location.line < cache.length) {
		return Math.min(Math.max(0, cache[location.line] + location.column), value.length)
	}
	return value.length
}

/**
 * 生成包含每行第一个字符索引的数组
 * @param value 要处理的字符串
 * @param cache 已存在的缓存对象
 * @param maxIndex 最大构建的索引数
 * @param maxLine 最大构建的行数
 */
function buildIndex(value: string, cache?: number[] & { index?: number }, maxIndex?: number, maxLine?: number) {
	if (cache) {
		if (cache.index != undefined) {
			return cache
		}
		maxIndex = value.length - 1
		maxLine = undefined
		cache.length = 0
		cache.push(0)
	} else {
		cache = [0]
		if (maxIndex === undefined) maxIndex = value.length - 1
	}
	for (let i = 0; i <= maxIndex; i++) {
		let ch = value.charCodeAt(i)
		if (ch === 13 /*\r*/) {
			if (value.charCodeAt(i + 1) === 10 /*\n*/) {
				i++
			}
			ch = 10
		}
		if (ch === 10 /*\n*/) {
			cache.push(i + 1)
			if (maxLine !== undefined && cache.length > maxLine) {
				break
			}
		}
	}
	cache.index = 0
	return cache
}