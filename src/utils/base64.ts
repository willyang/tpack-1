/**
 * 使用 Base64 编码指定的数据
 * @param data 要编码的字符串或二进制数据
 * @example encodeBase64("A") // "QQ=="
 */
export function encodeBase64(data: string | Buffer) {
	return (data instanceof Buffer ? data : Buffer.from(data)).toString("base64")
}

/**
 * 解码指定的 Base64 字符串
 * @param value 要解码的 Base64 字符串
 * @example decodeBase64("QQ==") // "A"
 */
export function decodeBase64(value: string) {
	return Buffer.from(value, "base64").toString()
}

/**
 * 获取指定数据的 Data URI
 * @param mimeType 数据的 MIME 类型
 * @param data 要编码的字符串或二进制数据
 * @example encodeDataURI("text/javascript", "A") // "data:text/javascript;base64,QQ=="
 */
export function encodeDataURI(mimeType: string, data: string | Buffer) {
	return `data:${mimeType};base64,${encodeBase64(data)}`
}

/**
 * 解码指定的 Data URI，如果解码失败则返回空
 * @param value 要解码的 data 地址
 * @example decodeDataURI("data:text/javascript;base64,QQ==") // {mimeType: "text/javascript", data: Buffer.from("A")}
 */
export function decodeDataURI(value: string) {
	const match = /^data:([^;]*);([^,]*),/.exec(value)
	return match ? {
		mimeType: match[1],
		data: Buffer.from(value.slice(match[0].length), match[2])
	} : null
}