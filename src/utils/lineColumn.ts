/** 表示一个行列号 */
export interface LineColumn {
	/** 行号（从 0 开始）*/
	line: number
	/** 列号（从 0 开始）*/
	column: number
}

/**
 * 计算指定索引对应的行列号
 * @param content 要计算的内容
 * @param index 要计算的索引
 * @param cache 如果提供了一个缓存数组，则存放索引数据以加速检索
 * @returns 如果索引超出范围则返回最近的行列号
 */
export function indexToLineColumn(content: string, index: number, cache?: number[] & { index?: number }) {
	if (index > 0) {
		cache = buildIndex(content, cache, index)
		let cursor = cache.index!
		while (cache[cursor] <= index) {
			cursor++
		}
		while (cursor >= cache.length || cache[cursor] > index) {
			cursor--
		}
		// 实际项目中，一般每次检索的位置都是上一次检索位置附近
		// 为了加速下次检索，缓存当前位置
		cache.index = cursor
		return { line: cursor, column: index - cache[cursor] } as LineColumn
	}
	return { line: 0, column: 0 } as LineColumn
}

/**
 * 计算指定行列号对应的索引
 * @param content 要计算的内容
 * @param location 要计算的行列号
 * @param cache 如果提供了一个缓存数组，则存放索引数据以加速检索
 * @returns 如果行列号超出范围则返回最近的索引
 */
export function lineColumnToIndex(content: string, location: LineColumn, cache?: number[] & { index?: number }) {
	if (location.line < 0) {
		return 0
	}
	cache = buildIndex(content, cache, undefined, location.line)
	if (location.line < cache.length) {
		return Math.min(Math.max(0, cache[location.line] + location.column), content.length)
	}
	return content.length
}

/**
 * 生成包含每行第一个字符索引的数组
 * @param value 要处理的字符串
 * @param cache 已有的缓存对象
 * @param maxIndex 要计算的最大索引
 * @param maxLine 要计算的最大行号
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