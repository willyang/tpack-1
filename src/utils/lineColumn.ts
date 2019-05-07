/**
 * 计算指定索引对应的行列号
 * @param content 要计算的内容
 * @param index 要计算的索引
 * @param cache 如果提供了一个缓存数组，则存放索引数据以加速检索
 */
export function indexToLineColumn(content: string, index: number, cache?: number[] & { lastIndex?: number }) {
	if (index <= 0) {
		return { line: 0, column: index }
	}
	if (cache) {
		// 实际项目中，每次计算的位置都会比较靠近，所以每次都要记住本次搜索的位置，加速下次搜索
		buildIndexCache(content, cache)
		let cacheIndex = cache.lastIndex!
		while (cacheIndex < cache.length - 1 && cache[cacheIndex] <= index) {
			cacheIndex++
		}
		while (cacheIndex > 0 && cache[cacheIndex] > index) {
			cacheIndex--
		}
		cache.lastIndex = cacheIndex
		return { line: cacheIndex, column: index - cache[cacheIndex] } as LineColumn
	}
	let line = 0
	let column = 0
	for (let i = 0; i < index; i++) {
		switch (content.charCodeAt(i)) {
			case 13 /*\r*/:
				if (content.charCodeAt(i + 1) === 10 /*\n*/) {
					i++
					if (index === i) {
						column++
						break
					}
				}
			// fall through
			case 10 /*\n*/:
				line++
				column = 0
				break
			default:
				column++
				break
		}
	}
	return { line, column } as LineColumn
}

/**
 * 计算指定行列号对应的索引
 * @param content 要计算的内容
 * @param location 要计算的行列号
 * @param cache 如果提供了一个缓存数组，则存放索引数据以加速检索
 */
export function lineColumnToIndex(content: string, location: LineColumn, cache?: number[] & { lastIndex?: number }) {
	if (location.line > 0) {
		if (cache) {
			buildIndexCache(content, cache)
			if (location.line < cache.length) {
				return cache[location.line] + location.column
			}
			return content.length + location.column
		}
		let index = 0
		let line = 0
		outer: while (index < content.length) {
			switch (content.charCodeAt(index++)) {
				case 13 /*\r*/:
					if (content.charCodeAt(index) === 10 /*\n*/) {
						index++
					}
				// fall through
				case 10 /*\n*/:
					if (++line === location.line) {
						break outer
					}
					break
			}
		}
		return index + location.column
	}
	return location.column
}

/** 表示一个行列号 */
export interface LineColumn {
	/** 行号（从 0 开始）*/
	line: number
	/** 列号（从 0 开始）*/
	column: number
}

/**
 * 生成包含每行第一个字符索引的缓存对象
 * @param content 要处理的字符串
 * @param cache 已有的缓存对象
 */
function buildIndexCache(content: string, cache: number[] & { lastIndex?: number }) {
	if (cache.lastIndex !== undefined) {
		return
	}
	cache.lastIndex = 0
	cache.push(0)
	for (let i = 0; i < content.length; i++) {
		switch (content.charCodeAt(i)) {
			case 13 /*\r*/:
				if (content.charCodeAt(i + 1) === 10 /*\n*/) {
					i++
				}
			// fall through
			case 10 /*\n*/:
				cache.push(i + 1)
				break
		}
	}
}