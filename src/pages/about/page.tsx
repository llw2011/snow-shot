"use client";

import { GithubOutlined, ReloadOutlined } from "@ant-design/icons";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Badge, Button, Divider, Tag, Typography, theme } from "antd";
import { compare } from "compare-versions";
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useIntl } from "react-intl";
import { AntdContext } from "@/contexts/antdContext";
import {
	checkForUpdate,
	formatUpdateProgress,
	formatUpdaterError,
	installUpdate,
	isUpdaterUnavailableError,
	runWithUpdatePromptLock,
} from "@/services/updater";
import { appWarn } from "@/utils/log";

const { Title, Paragraph, Text } = Typography;

export const AboutPage = () => {
	const { token } = theme.useToken();
	const intl = useIntl();
	const { isConfirmingRef, message, modal } = useContext(AntdContext);
	const [version, setVersion] = useState<string>();
	const [latestVersion, setLatestVersion] = useState<string>();
	const [checking, setChecking] = useState(false);
	const [installing, setInstalling] = useState(false);

	const inited = useRef(false);
	const updateActionRef = useRef(false);
	const init = useCallback(async () => {
		if (inited.current) {
			return;
		}
		inited.current = true;

		try {
			const currentVersion = await getVersion();
			setVersion(currentVersion);
		} catch (error) {
			appWarn(
				"[AboutPage] failed to read application version",
				formatUpdaterError(error),
			);
		}
	}, []);

	useEffect(() => {
		void init();
	}, [init]);

	const checkForUpdates = useCallback(async () => {
		if (updateActionRef.current || isConfirmingRef.current) {
			return;
		}

		updateActionRef.current = true;
		setChecking(true);
		try {
			const update = await checkForUpdate();
			if (!update) {
				setLatestVersion(undefined);
				message.success(intl.formatMessage({ id: "common.newVersion.latest" }));
				return;
			}

			setLatestVersion(update.version);

			await runWithUpdatePromptLock(async () => {
				if (isConfirmingRef.current) {
					return;
				}

				const confirmed = await modal.confirmWithStatus({
					title: intl.formatMessage(
						{ id: "common.newVersion.title" },
						{ latestVersion: update.version },
					),
					content: intl.formatMessage(
						{ id: "common.newVersion" },
						{
							latestVersion: update.version,
							currentVersion: update.currentVersion,
						},
					),
					okText: intl.formatMessage({ id: "common.newVersion.updateNow" }),
					cancelText: intl.formatMessage({
						id: "common.newVersion.updateLater",
					}),
					centered: true,
				});

				if (!confirmed) {
					return;
				}

				setInstalling(true);
				let lastProgressAt = 0;
				message.open({
					key: "about-update",
					type: "loading",
					content: intl.formatMessage({ id: "common.newVersion.downloading" }),
					duration: 0,
				});
				const installed = await installUpdate(update.version, (progress) => {
					const now = Date.now();
					if (!progress.finished && now - lastProgressAt < 120) {
						return;
					}
					lastProgressAt = now;

					message.open({
						key: "about-update",
						type: "loading",
						content: `${intl.formatMessage({ id: "common.newVersion.downloading" })} (${formatUpdateProgress(progress)})`,
						duration: 0,
					});
				});
				if (!installed) {
					message.open({
						key: "about-update",
						type: "info",
						content: intl.formatMessage({ id: "common.newVersion.latest" }),
						duration: 5,
					});
				}
			});
		} catch (error) {
			const details = formatUpdaterError(error);
			if (isUpdaterUnavailableError(error)) {
				message.open({
					key: "about-update",
					type: "info",
					content: intl.formatMessage({ id: "common.newVersion.unavailable" }),
					duration: 6,
				});
			} else {
				appWarn("[AboutPage] update check/install failed", details);
				message.open({
					key: "about-update",
					type: "error",
					content: intl.formatMessage(
						{ id: "common.newVersion.updateFailed" },
						{ error: details },
					),
					duration: 6,
				});
			}
		} finally {
			updateActionRef.current = false;
			setChecking(false);
			setInstalling(false);
		}
	}, [intl, isConfirmingRef, message, modal]);

	const hasNewVersion = useMemo(() => {
		return (
			latestVersion !== undefined &&
			version !== undefined &&
			compare(latestVersion, version, ">")
		);
	}, [latestVersion, version]);

	return (
		<div
			style={{
				margin: `${token.marginLG}px 0`,
				minHeight: "100vh",
			}}
		>
			{/* 头部信息 */}
			<div style={{ textAlign: "center", marginBottom: token.marginLG }}>
				<div style={{ marginBottom: -12 }}>
					<img
						src={"/images/app-icon.png"}
						alt="Snow Shot"
						width={100}
						height={100}
					/>
				</div>

				<Title level={2} style={{ marginTop: token.marginSM }}>
					<Badge
						count={
							hasNewVersion
								? intl.formatMessage({ id: "about.newVersion" })
								: undefined
						}
						style={{ display: "block", cursor: "pointer" }}
						size="small"
						onClick={() => void checkForUpdates()}
					>
						<div
							style={{
								fontSize: token.fontSizeHeading2,
								marginTop: token.marginXS,
							}}
						>
							<span style={{ color: "var(--snow-shot-primary)" }}>Snow </span>
							<span>Shot</span>
						</div>
					</Badge>
				</Title>
				<div>
					<Text type="secondary">
						{intl.formatMessage({ id: "about.subtitle" })}
					</Text>
				</div>
				<div style={{ marginTop: token.margin }}>
					<Tag>
						<span>
							{intl.formatMessage({ id: "about.version" })} {version ?? "—"}
						</span>
					</Tag>
					<Tag>{intl.formatMessage({ id: "about.author" })}</Tag>
					<Button
						type={hasNewVersion ? "primary" : "default"}
						icon={<ReloadOutlined />}
						loading={checking || installing}
						onClick={() => void checkForUpdates()}
						size="small"
					>
						{intl.formatMessage({ id: "common.newVersion.check" })}
					</Button>
				</div>
			</div>

			<Divider />

			{/* 开源协议 */}
			<div style={{ marginBottom: token.marginLG }}>
				<Title level={3}>
					{intl.formatMessage({ id: "about.license.title" })}
				</Title>
				<Paragraph>
					{intl.formatMessage({ id: "about.license.description" })}
				</Paragraph>
				<ul>
					<li>
						<strong>
							{intl.formatMessage({ id: "about.license.nonCommercial" })}
						</strong>
						<a
							onClick={() =>
								openUrl("https://www.apache.org/licenses/LICENSE-2.0")
							}
						>
							{intl.formatMessage({ id: "about.license.nonCommercialType" })}
						</a>
					</li>
					<li>
						<strong>
							{intl.formatMessage({ id: "about.license.commercial" })}
						</strong>
						<a
							onClick={() =>
								openUrl("https://www.gnu.org/licenses/gpl-3.0.html")
							}
						>
							{intl.formatMessage({ id: "about.license.commercialType" })}
						</a>
					</li>
				</ul>
			</div>

			{/* 问题反馈 */}
			<div style={{ marginBottom: token.marginLG }}>
				<Title level={3}>
					{intl.formatMessage({ id: "about.feedback.title" })}
				</Title>
				<Button
					type="primary"
					icon={<GithubOutlined />}
					onClick={() => openUrl("https://github.com/llw2011/snow-shot/issues")}
					block
				>
					{intl.formatMessage({ id: "about.feedback.github" })}
				</Button>
			</div>
		</div>
	);
};
