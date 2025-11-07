export default {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"type-enum": [
			2,
			"always",
			[
				"feat", // 新功能
				"fix", // 修复 bug
				"docs", // 文档变更
				"style", // 代码格式（不影响代码运行的变动）
				"refactor", // 重构（既不是新增功能，也不是修改 bug 的代码变动）
				"perf", // 性能优化
				"test", // 增加测试
				"build", // 构建过程或辅助工具的变动
				"ci", // CI 配置文件和脚本的变动
				"chore", // 其他改动
				"revert", // 回滚 commit
			],
		],
		"subject-case": [0], // subject 大小写不做限制
		"subject-max-length": [2, "always", 100], // subject 最大长度
		"body-leading-blank": [2, "always"], // body 前要有空行
		"footer-leading-blank": [2, "always"], // footer 前要有空行
	},
};

