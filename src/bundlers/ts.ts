import { Module } from "../core/module"
import { Builder, Bundler } from "../core/builder"
import * as ts from "typescript"

/** 表示一个 TypeScript 模块打包器 */
export class TSBundler implements Bundler {

	parse(module: Module) {
		//const ast = ts.createProgram([], tsc, {

		//})
	}

	// #region TypeScript 转换

	readonly globals = new Map<string, string>()

	transformor = (ctx: ts.TransformationContext) => {
		ctx.hoistVariableDeclaration
		const visitor: ts.Visitor = (node: ts.Node): ts.Node => {
			switch (node.kind) {
				case ts.SyntaxKind.Identifier:
					if (isGlobal(node)) {

					} else {

					}
					break
				case ts.SyntaxKind.IfStatement
			}
			return ts.visitEachChild(node, visitor, ctx)
		}
		return (sf: ts.SourceFile) => ts.visitNode(sf, visitor)
	}

	private _parseTSWorker(module: Module, ast: ts.Program) {
		const checker = ast.getTypeChecker()
		checker.getSymbolsInScope()
	}

	// #endregion

	// #region 公共模块提取

	bundle(modules: Module[], builder: Builder) {
		// 如果每个入口模块在运行时加载其依赖模块和依赖的依赖，会导致页面请求数过多
		// 反之如果把每个入口模块和其依赖各自合并成独立的包，会导致很多模块被重复下载
		// 因此我们需要一个算法来提取部分公共模块，以维持页面请求数和模块重复下载率之间的平衡

		// 所有入口模块和动态导入的模块都会生成一个包（Bundle），提取的公共模块也将组成一个新包
		// 一个包可能有多个父包，如果父包包含了一个模块，则子包不需要重复包含
		// 提取算法的目的就是计算所有的包以及包包含的模块

		// 提取算法的核心思想是：在未超出请求数限制时，按以下优先级提取公共模块：
		// 1. 最不常更新的模块（通过路径配置），以确保缓存的最大利用率
		// 2. 被不同包依赖次数最多的模块，以确保缓存的最大命中率
		// 3. 提取的公共模块体积最大，以确保所有包的总体积最小
		// 4. 提取的公共模块数最多，以确保所有包加上加载器的总体积最小
		// 5. 提取的公共模块路径排名，以确保每次打包提取的模块是相同的

		// 假如有以下模块（大写表示入口模块，小写表示外部模块，箭头表示依赖关系）：
		// A -> a, b, c, d
		// B -> a, b; C
		// C -> b; D
		// D -> c, d; B
		// E -> e; g(动态依赖)
		// g -> f; E

		// 第一步：生成所有入口模块和动态导入的模块对应的包，并计算入口包之间的依赖关系（删除循环依赖）：
		// A -> a, b, c, d
		// B -> a; C
		// C -> b
		// D -> c, d; B
		// E -> e; g(动态依赖)
		// g -> f

		// 第二步：计算所有提取包公共模块的所有组合方式（左侧表示包的组合，右侧表示该组合可公共的模块）：
		// [A, B] -> a
		// [A, C] -> b
		// [A, D] -> c, d
		// [E] -> e
		// [async(D)] -> g, f

		// 第三步：对所有组合方式按算法设定的优先级排序：
		// [A, D] -> c, d
		// [A, C] -> b
		// [A, B] -> a
		// [E] -> e
		// [async(D)] -> g, f

		// 第四步：按顺序使用所有组合方式，剩下未使用的将被抛弃：
		// VENDOR1 -> c, d
		// VENDOR2 -> b
		// A -> a; VENDOR2; VENDOR1
		// B -> a; VENDOR2; C
		// C -> VENDOR2; D
		// D -> VENDOR1; B
		// E -> e; g(动态依赖)
		// async(D) -> g, f

		/** 缓存一个模块解析后的信息 */
		interface ModuleInfo {
			/** 所有静态依赖的入口模块列表 */
			entryModuleImports?: Set<Module>
			/** 所有静态依赖的非入口模块列表 */
			staticImports?: Set<Module>
			/** 所有动态依赖的模块列表 */
			dynamicImports?: Set<Module>
			/** 如果当前模块是入口模块，则为关联的包 */
			bundle?: Bundle
		}
		// 存储所有模块数据，将数据单独提取出而不是保存模块自身，是为了打包结束后快速清理内存
		const moduleInfos = new Map<Module, ModuleInfo>()
		/** 获取指定模块对应的数据 */
		function getModuleInfo(module: Module) {
			let moduleInfo = moduleInfos.get(module)
			if (!moduleInfo) {
				moduleInfos.set(module, moduleInfo = {})
				if (module.dependencies) {
					for (const dependency of module.dependencies) {
						const parentModule = dependency.module
						// 1. 如果模块解析失败，则 parentModule 为空，忽略
						// 2. 只处理 JS 到 JS 的依赖
						// 3. 忽略模块循环依赖
						if (parentModule && parentModule.type === "js" && parentModule !== module) {
							if (dependency.dynamic) {
								const dynamicImports = moduleInfo.dynamicImports ||
									(moduleInfo.dynamicImports = new Set<Module>())
								dynamicImports.add(parentModule)
							} else if (parentModule.isEntryModule) {
								const mainModuleImports = moduleInfo.entryModuleImports ||
									(moduleInfo.entryModuleImports = new Set<Module>())
								mainModuleImports.add(parentModule)
							} else {
								// 合并依赖的依赖
								const parentModuleInfo = getModuleInfo(parentModule)
								const staticImports = moduleInfo.staticImports ||
									(moduleInfo.staticImports = new Set<Module>())
								if (parentModuleInfo.staticImports) {
									for (const grandParentModule of parentModuleInfo.staticImports) {
										if (grandParentModule !== module) {
											staticImports.add(grandParentModule)
										}
									}
								}
								staticImports.add(parentModule)
								if (parentModuleInfo.dynamicImports) {
									const dynamicImports = moduleInfo.dynamicImports ||
										(moduleInfo.dynamicImports = new Set<Module>())
									for (const grandParentModule of parentModuleInfo.dynamicImports) {
										if (grandParentModule !== module) {
											dynamicImports.add(grandParentModule)
										}
									}
								}
								if (parentModuleInfo.entryModuleImports) {
									const mainModuleImports = moduleInfo.entryModuleImports ||
										(moduleInfo.entryModuleImports = new Set<Module>())
									for (const grandParentModule of parentModuleInfo.entryModuleImports) {
										if (grandParentModule !== module) {
											mainModuleImports.add(grandParentModule)
										}
									}
								}
							}
						}
					}
				}
			}
			return moduleInfo
		}

		// 存储所有生成的包
		const bundles: Bundle[] = []
		// 存储延时处理的动态加载模块
		const dynamicModules: ModuleInfo[] = []
		// 如果入口模块有循环依赖，算法会保留先处理的模块依赖，删除后处理的模块依赖
		// 猜测实际项目中越期望公用的文件路径排名越靠前（比如名为 common）
		// 所以应该先处理路径排名靠后的模块，files 是按路径顺序排列的，需要倒序遍历
		for (let i = files.length - 1; i >= 0; i--) {
			const module = files[i].module!
			if (module.type === "js") {
				createBundle(module).index = i
				while (dynamicModules.length) {
					const moduleInfo = dynamicModules.pop()!
					for (const dynamicImport of moduleInfo.dynamicImports!) {
						if (dynamicImport.isEntryModule) {
							createBundle(dynamicImport).type = BundleType.staticOrDynamic
						} else {
							// 创建一个临时模块，包含源包和目标模块的所有依赖，生成的包会自动排除源包包含的所有模块
							const dynamicModule = new DynamicJSModule(files[i], this)
							dynamicModule.isEntryModule = true
							dynamicModule.addDependency("").module = moduleInfo.bundle!.mainModule
							dynamicModule.addDependency("").module = dynamicImport
							const dynamicBundle = createBundle(dynamicModule)
							dynamicBundle.type = BundleType.dynamic
							// 删除 moduleInfo.bundle 的引用
							dynamicBundle.parentBundles!.shift()
						}
					}
				}
				/** 创建模块对应的包 */
				function createBundle(module: Module): Bundle {
					const moduleInfo = getModuleInfo(module)
					// 如果有其它模块依赖了当前模块，则在处理其它模块时已创建对应的包
					let bundle = moduleInfo.bundle
					if (!bundle) {
						moduleInfo.bundle = bundles[bundles.length] = bundle = new Bundle(bundles.length.toString(), module)
						// 包依赖会影响模块依赖，所以先处理包的依赖
						if (moduleInfo.entryModuleImports) {
							// 标记当前包正在处理，如果此时处理依赖的包时检测到已标记的包，说明存在循环依赖
							bundle.creating = true
							const parentBundles = bundle.parentBundles || (bundle.parentBundles = [])
							for (const parentModule of moduleInfo.entryModuleImports) {
								const parentBundle = createBundle(parentModule)
								// 删除循环依赖关系
								if (parentBundle.creating) {
									continue
								}
								parentBundles.push(parentBundle)
							}
							delete bundle.creating
						}
						// 添加初始包包含的模块
						if (moduleInfo.staticImports) {
							outer: for (const staticImport of moduleInfo.staticImports) {
								// 删除在任一父包中已包含的模块
								if (bundle.parentBundles) {
									for (const parentBundle of bundle.parentBundles) {
										const parentModuleInfo = getModuleInfo(parentBundle.mainModule!)
										if (parentModuleInfo.staticImports && parentModuleInfo.staticImports.has(staticImport)) {
											continue outer
										}
									}
								}
								bundle.add(staticImport)
							}
						}
						// 为了避免影响静态包依赖分析，动态加载的模块延时到最后处理
						if (moduleInfo.dynamicImports) {
							dynamicModules.push(moduleInfo)
						}
					}
					return bundle
				}
			}
		}

		/** 表示一种包组合方式 */
		interface Combination {
			/** 当前组合的唯一标识 */
			readonly id: string
			/** 要组合的所有包 */
			readonly bundles: Bundle[]
			/** 当前组合的所有包公共的模块 */
			readonly modules: Set<Module>
			/** 当前组合内所有模块的大小 */
			size?: number
		}
		// 生成所有公共包
		for (const commonModule of this.jsCommonModules) {

			// 查找要提取的模块
			let selectedModules: Set<Module> | undefined
			if (commonModule.matcher) {
				selectedModules = new Set<Module>()
				for (const [module, moduleInfo] of moduleInfos) {
					if (selectedModules.has(module) || !commonModule.matcher.test(module.path)) {
						continue
					}
					// 将模块和模块的依赖加入结果列表
					if (moduleInfo.staticImports) {
						for (const staticImport of moduleInfo.staticImports) {
							selectedModules.add(staticImport)
						}
					}
					selectedModules.add(module)
				}
			}

			// 存储所有可用的组合方式
			const moduleCombiniations = new Map<Module, Combination>()
			const combinations = new Map<string, Combination>()
			for (const bundle of bundles) {
				// 跳过不能再提取公共包的包
				if ((bundle.parentBundles ? bundle.parentBundles.length : 0) >= (bundle.type === BundleType.dynamic ? commonModule.maxAsyncRequests : commonModule.maxInitialRequests)) {
					continue
				}
				for (const module of bundle) {
					// 跳过未筛选的模块
					if (selectedModules && !selectedModules.has(module)) {
						continue
					}
					// 如果模块已经属于某个组合，则更新原组合
					let id: string
					const oldCombination = moduleCombiniations.get(module)
					if (oldCombination) {
						oldCombination.modules.delete(module)
						id = `${oldCombination.id}|${bundle.id}`
					} else {
						id = bundle.id
					}
					let combination = combinations.get(id)
					if (!combination) {
						combinations.set(id, combination = {
							id: id,
							bundles: oldCombination ? [...oldCombination.bundles, bundle] : [bundle],
							modules: new Set<Module>()
						})
					}
					combination.modules.add(module)
					moduleCombiniations.set(module, combination)
				}
			}

			if (commonModule.minSize > 0) {
				let size = 0
				for (const module of moduleCombiniations.keys()) {
					size += module.size!
				}
				if (size < commonModule.minSize) {
					continue
				}
			}

			const commonBundle = new Bundle("")
			if (Number.isFinite(commonModule.maxSize)) {
				// 如果模块的大小被限制，则需要先将组合按大小排序
				const combinationsSorted: Combination[] = []
				for (const combination of combinations.values()) {
					if (combination.bundles.length < commonModule.minUseCount) {
						continue
					}
					combination.size = 0
					for (const module of combination.modules) {
						combination.size += module.size!
					}
					insertOrdered(combinationsSorted, combination, (combination1, combination2) => {
						// 公共的包数最多
						if (combination1.bundles.length !== combination2.bundles.length) {
							return combination1.bundles.length > combination2.bundles.length
						}
						if (combination1.size! !== combination2.size!) {
							return combination1.size! > combination2.size!
						}
						if (combination1.modules.size !== combination2.modules.size) {
							return combination1.modules.size > combination2.modules.size
						}
						// 确保每次打包生成的公共文件完全相同
						return combination1.id < combination2.id
					})
				}
				let size = 0
				for (const combination of combinationsSorted) {
					size += combination.size!
					// 将公共的模块从原包移除然后添加到公共包
					if (size >= commonModule.maxSize) {
						size -= combination.size!
						for (const module of Array.from(combination.modules).sort((x, y) => y.size! - x.size!)) {
							if (size + module.size! < commonModule.maxSize) {
								size += module.size!
								addModuleToCommonBundle(module, commonBundle, combination)
							}
						}
						break
					} else {
						for (const module of combination.modules) {
							addModuleToCommonBundle(module, commonBundle, combination)
						}
					}
				}
			} else {
				for (const combination of combinations.values()) {
					// 可复用包次数不符合要求
					if (combination.bundles.length < commonModule.minUseCount) {
						// 将公共的模块从原包移除然后添加到公共包
						for (const module of combination.modules) {
							addModuleToCommonBundle(module, commonBundle, combination)
						}
					}
				}
			}

			/** 将模块移到公共包 */
			function addModuleToCommonBundle(module: Module, commonBundle: Bundle, combination: Combination) {
				commonBundle.add(module)
				for (const bundle of combination.bundles) {
					bundle.delete(module)
					const parentBundles = bundle.parentBundles || (bundle.parentBundles = [])
					parentBundles.push(bundle)
				}
			}
		}

	}

	// #endregion

	generate(module: Module, builder: Builder) {

	}

}

function isGlobal(node: ts.Node) {
	return false
}