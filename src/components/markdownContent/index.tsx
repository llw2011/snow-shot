import { CopyOutlined } from "@ant-design/icons";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button, Typography } from "antd";
import type React from "react";
import Markdown, { type ExtraProps } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { copyText } from "@/utils/clipboard";

// Syntax colors follow the app tokens so code reads well in both modes.
const PRISM_STYLE = {
	'code[class*="language-"]': {
		background: "transparent",
		color: "var(--snow-shot-body)",
		fontFamily: "var(--snow-shot-font-mono)",
		fontSize: "12.5px",
		lineHeight: "1.6",
	},
	'pre[class*="language-"]': {
		margin: 0,
		padding: "12px 14px",
		overflow: "auto",
		background: "transparent",
		color: "var(--snow-shot-body)",
		fontFamily: "var(--snow-shot-font-mono)",
		lineHeight: "1.6",
	},
	comment: { color: "var(--snow-shot-muted)", fontStyle: "italic" },
	prolog: { color: "var(--snow-shot-muted)" },
	cdata: { color: "var(--snow-shot-muted)" },
	punctuation: { color: "var(--snow-shot-body)" },
	entity: { color: "var(--snow-shot-primary)" },
	"attr-name": { color: "var(--snow-shot-yellow)" },
	"class-name": { color: "var(--snow-shot-yellow)" },
	boolean: { color: "var(--snow-shot-primary)" },
	constant: { color: "var(--snow-shot-primary)" },
	number: { color: "var(--snow-shot-primary)" },
	keyword: { color: "var(--snow-shot-red)" },
	property: { color: "var(--snow-shot-blue)" },
	tag: { color: "var(--snow-shot-green)" },
	selector: { color: "var(--snow-shot-green)" },
	string: { color: "var(--snow-shot-green)" },
	char: { color: "var(--snow-shot-green)" },
	builtin: { color: "var(--snow-shot-blue)" },
	variable: { color: "var(--snow-shot-ink)" },
	operator: { color: "var(--snow-shot-body)" },
	function: { color: "var(--snow-shot-blue)" },
} satisfies Record<string, React.CSSProperties>;

const CodeBlock: React.FC<{
	props: React.ClassAttributes<HTMLElement> &
		React.HTMLAttributes<HTMLElement> &
		ExtraProps;
	language: string;
}> = ({ props, language }) => {
	const { children, ...rest } = props;
	const code = String(children).replace(/\n$/, "");
	return (
		<div className="markdown-code">
			<div className="markdown-code-header">
				<span>{language}</span>
				<Button
					type="text"
					size="small"
					icon={<CopyOutlined />}
					onClick={() => copyText(code)}
				/>
			</div>
			<SyntaxHighlighter
				{...rest}
				ref={undefined}
				language={language}
				style={PRISM_STYLE}
				wrapLongLines
			>
				{code}
			</SyntaxHighlighter>
		</div>
	);
};

/** GitHub-flavored Markdown with math, code blocks and external links. */
export const MarkdownContent: React.FC<{
	content: string;
	/** Text copied by surrounding actions; kept on props for consumers. */
	clipboardContent: string;
	disableCodeCard?: boolean;
}> = ({ content, disableCodeCard }) => {
	return (
		<Typography>
			<div className="markdown-body">
				<Markdown
					components={{
						code(props) {
							const { children, className, ...rest } = props;
							const match = /language-(\w+)/.exec(className || "");
							return match && !disableCodeCard ? (
								<CodeBlock language={match[1]} props={props} />
							) : (
								<code {...rest} className={className}>
									{children}
								</code>
							);
						},
						a: (props) => (
							<a
								{...props}
								onClick={(event) => {
									event.preventDefault();
									if (props.href) {
										openUrl(props.href);
									}
								}}
							/>
						),
					}}
					remarkPlugins={[remarkMath, remarkGfm]}
					rehypePlugins={[rehypeKatex]}
				>
					{content}
				</Markdown>
			</div>

			<style jsx>{`
				:global(.markdown-body pre) {
					padding: 0;
					background: transparent;
				}

				:global(.markdown-body) {
					background: transparent !important;
					font-size: 14px;
				}

				:global(.markdown-code) {
					margin: 8px 0;
					overflow: hidden;
					border: 1px solid var(--snow-shot-hairline-soft);
					border-radius: var(--snow-shot-radius);
					background: var(--snow-shot-surface-elevated);
				}

				:global(.markdown-code-header) {
					display: flex;
					align-items: center;
					justify-content: space-between;
					height: 30px;
					padding: 0 4px 0 12px;
					border-bottom: 1px solid var(--snow-shot-hairline-soft);
					color: var(--snow-shot-muted);
					font-family: var(--snow-shot-font-mono);
					font-size: 12px;
				}

				:global(.markdown-code pre > div),
				:global(.markdown-code pre) {
					margin: 0 !important;
				}
			`}</style>
		</Typography>
	);
};
