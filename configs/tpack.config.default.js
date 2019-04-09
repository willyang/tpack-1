export default function (args) {
	const isProject = require("fs").existsSync("src")
	return {
		rootDir: isProject ? "src" : process.cwd(),
		outDir: "dist",
		devServer: !args["--filter"]
	}
}