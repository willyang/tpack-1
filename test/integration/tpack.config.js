export default {
	rootDir: "fixtures",
	outDir: "out",
	compilers: [
		...require("tpack/data/optimizers.json"),
		{ match: "*.html", use: "tpack/optimizers/html" },
		...require("tpack/data/compilers.json"),
	],
	plugins: [
		new (require("tpack/plugins/saveErrorAndWarning").default)()
	]
}