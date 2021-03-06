/**
 * 删除字符串开头的 UTF-8 BOM 字符
 * @param content 要处理的字符串
 */
export function stripBOM(content: string) {
	if (content.charCodeAt(0) === 0xfeff) {
		content = content.slice(1)
	}
	return content
}

/**
 * 按顺序插入元素到已排序的数组中
 * @param sortedArray 已排序的数组
 * @param item 要插入的值
 * @param comparer 确定元素顺序的回调函数，如果函数返回 `true`，则将 `x` 排在 `y` 的前面，否则相反
 * @param comparer.x 要比较的第一个元素
 * @param comparer.y 要比较的第二个元素
 */
export function insertSorted<T>(sortedArray: T[], item: T, comparer: (x: T, y: T) => boolean) {
	let start = 0
	let end = sortedArray.length - 1
	while (start <= end) {
		const middle = start + ((end - start) >> 1)
		if (comparer(sortedArray[middle], item)) {
			start = middle + 1
		} else {
			end = middle - 1
		}
	}
	sortedArray.splice(start, 0, item)
}

/**
 * 创建一个新函数，调用该函数后会延时调用原函数，如果在延时等待期间有新的调用，则重新开始计时
 * @param func 要调用的原函数
 * @param timeout 延时的毫秒数
 * @example document.onscroll = defer(() => console.log("延时执行"), 100)
 */
export function defer<T extends Function>(func: T, timeout = 0) {
	let timer: ReturnType<typeof setTimeout> | undefined
	return function (this: any, ...args: any[]) {
		if (timer) clearTimeout(timer)
		timer = setTimeout(() => {
			timer = undefined
			func.apply(this, args)
		}, timeout)
	} as Function as T
}

/**
 * 编码正则表达式的特殊字符
 * @param pattern 要编码的正则表达式模式
 */
export function escapeRegExp(pattern: string) {
	return pattern.replace(/[.\\(){}[\]\-+*?^$|]/g, "\\$&")
}

/**
 * 拷贝对象的所有内容到哈希表
 * @param src 要拷贝的源对象
 * @param dest 要拷贝的目标哈希表
 */
export function objectToMap<T>(src: { readonly [key: string]: T } | undefined, dest: Map<string, T>) {
	for (const key in src) {
		dest.set(key, src[key])
	}
}

/** 所有日期格式化器 */
const dateFormatters = {
	y: (date: Date, format: string) => {
		const year = date.getFullYear()
		return format.length < 3 ? year % 100 : year
	},
	M: (date: Date) => date.getMonth() + 1,
	d: (date: Date) => date.getDate(),
	H: (date: Date) => date.getHours(),
	m: (date: Date) => date.getMinutes(),
	s: (date: Date) => date.getSeconds()
}

/**
 * 格式化指定的日期对象
 * @param date 要处理的日期对象
 * @param format 格式字符串，其中以下字符（区分大小写）会被替换：
 *
 * 字符| 意义           | 示例
 * ----|---------------|--------------------
 * y   | 年            | yyyy: 1999, yy: 99
 * M   | 月（从 1 开始）| MM: 09, M: 9
 * d   | 日（从 1 开始）| dd: 09, d: 9
 * H   | 时（24 小时制）| HH: 13, H: 13
 * m   | 分            | mm: 06, m: 6
 * s   | 秒            | ss: 06, s: 6
 *
 * @example formatDate(new Date("2016/01/01 00:00:00"), "yyyyMMdd") // "20160101"
 * @see https://docs.oracle.com/javase/7/docs/api/java/text/SimpleDateFormat.html
 */
export function formatDate(date: Date, format: string) {
	return format.replace(/([yMdHms])\1*/g, (all, key: string) => {
		key = dateFormatters[key as keyof typeof dateFormatters](date, all) + ""
		while (key.length < all.length) {
			key = `0${key}`
		}
		return key
	})
}

/**
 * 格式化指定的高精度时间段
 * @param hrTime 由秒和纳秒部分组成的数组
 * @example formatHRTime([1, 20000000]) // "1.02s"
 */
export function formatHRTime(hrTime: [number, number]) {
	let value: number
	let unit: string
	if (hrTime[0] < 1) {
		if (hrTime[1] < 1e4) {
			return "<0.01ms"
		}
		value = hrTime[1] / 1e6
		unit = "ms"
	} else {
		value = hrTime[0] + hrTime[1] / 1e9
		if (value < 60) {
			unit = "s"
		} else {
			value /= 60
			unit = "min"
		}
	}
	return value.toFixed(2).replace(/\.00$|0$/, "") + unit
}

/**
 * 格式化指定的字节大小
 * @param byteSize 要格式化的字节大小
 * @example formatSize(1024) // "1.00KB"
 */
export function formatSize(byteSize: number) {
	let unit: string
	if (byteSize < 1000) {
		unit = "B"
	} else if (byteSize < 1024 * 1000) {
		byteSize /= 1024
		unit = "KB"
	} else if (byteSize < 1024 * 1024 * 1000) {
		byteSize /= 1024 * 1024
		unit = "MB"
	} else if (byteSize < 1024 * 1024 * 1024 * 1000) {
		byteSize /= 1024 * 1024 * 1024
		unit = "GB"
	} else {
		byteSize /= 1024 * 1024 * 1024 * 1024
		unit = "TB"
	}
	return byteSize.toFixed(2).replace(/\.00$|0$/, "") + unit
}