import { AutoComplete, Button, Input, Popconfirm, Switch, Tooltip } from "antd";
import type React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { WorkbenchIcon } from "@/components/workbench/icons";
import { isChatModel, PROVIDER_LABELS } from "./detection";
import type { ModelService, ModelServiceUses } from "./serviceModel";
import { getDetectionState, ServiceStatusText } from "./serviceStatus";
import { ServiceTest } from "./serviceTest";
import { useServiceStatus } from "./useModelServices";

export type UseAvailability = Record<keyof ModelServiceUses, boolean>;

const USES: (keyof ModelServiceUses)[] = ["chat", "translation", "ocr"];

const hostOf = (uri: string) => {
	try {
		const url = new URL(uri);
		return url.host;
	} catch {
		return uri;
	}
};

const getUsableUses = (
	service: ModelService,
	availability: UseAvailability,
): Record<keyof ModelServiceUses, boolean> => ({
	chat: availability.chat && service.kind === "openai",
	translation: availability.translation,
	ocr: availability.ocr && service.kind === "openai" && service.supportVision,
});

/** Toggle chips that assign a service to chat, translation and OCR. */
export const UseChips: React.FC<{
	service: ModelService;
	availability: UseAvailability;
	defaults?: { chat: boolean; translation: boolean };
	onToggle: (use: keyof ModelServiceUses, enabled: boolean) => void;
	small?: boolean;
}> = ({ service, availability, defaults, onToggle, small }) => {
	const intl = useIntl();
	const canUse = getUsableUses(service, availability);

	return (
		<div className="model-chips">
			{USES.filter((use) => availability[use]).map((use) => {
				const on = service.uses[use];
				const isDefault =
					use === "chat"
						? defaults?.chat
						: use === "translation"
							? defaults?.translation
							: false;
				const disabledReason =
					!canUse[use] && !on
						? intl.formatMessage({
								id:
									use === "ocr"
										? "workbench.models.use.ocrNeedsVision"
										: "workbench.models.use.unsupported",
							})
						: undefined;

				const chip = (
					<button
						key={use}
						type="button"
						className={`model-chip${on ? " is-on" : ""}${small ? " is-small" : ""}`}
						aria-pressed={on}
						disabled={!!disabledReason}
						onClick={(event) => {
							event.stopPropagation();
							onToggle(use, !on);
						}}
					>
						{on && <WorkbenchIcon name="check" size={12} />}
						<FormattedMessage id={`workbench.models.use.${use}`} />
						{isDefault && (
							<span className="model-chip-tag">
								<FormattedMessage id="workbench.models.default" />
							</span>
						)}
					</button>
				);

				return disabledReason ? (
					<Tooltip key={use} title={disabledReason}>
						<span>{chip}</span>
					</Tooltip>
				) : (
					<span key={use}>{chip}</span>
				);
			})}
		</div>
	);
};

type ServiceRowProps = {
	service: ModelService;
	draft?: boolean;
	open: boolean;
	availability: UseAvailability;
	isDefaultChat: boolean;
	isDefaultTranslation: boolean;
	onOpenChange: (open: boolean) => void;
	onPatch: (patch: Partial<Omit<ModelService, "key" | "uses">>) => void;
	onToggleUse: (use: keyof ModelServiceUses, enabled: boolean) => void;
	onSetDefaultChat: () => void;
	onSetDefaultTranslation: () => void;
	onRemove: () => void;
};

/** Text fields keep a local value and commit on blur, Enter or a short pause. */
const useDeferredField = (value: string, commit: (value: string) => void) => {
	const [local, setLocal] = useState(value);
	const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const commitRef = useRef(commit);
	commitRef.current = commit;
	const localRef = useRef(local);
	localRef.current = local;

	useEffect(() => {
		setLocal(value);
	}, [value]);

	const flush = () => {
		clearTimeout(timerRef.current);
		if (localRef.current !== value) {
			commitRef.current(localRef.current);
		}
	};

	useEffect(
		() => () => {
			clearTimeout(timerRef.current);
		},
		[],
	);

	return {
		value: local,
		onChange: (next: string) => {
			setLocal(next);
			clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => commitRef.current(next), 700);
		},
		onBlur: flush,
		onPressEnter: flush,
	};
};

export const ServiceRow: React.FC<ServiceRowProps> = ({
	service,
	draft,
	open,
	availability,
	isDefaultChat,
	isDefaultTranslation,
	onOpenChange,
	onPatch,
	onToggleUse,
	onSetDefaultChat,
	onSetDefaultTranslation,
	onRemove,
}) => {
	const intl = useIntl();
	const fieldId = useId();
	const { detection, checking, refresh } = useServiceStatus(service);
	const state = getDetectionState(detection, checking);

	const uriField = useDeferredField(service.apiUri, (apiUri) =>
		onPatch({ apiUri }),
	);
	const keyField = useDeferredField(service.apiKey, (apiKey) =>
		onPatch({ apiKey }),
	);
	const modelField = useDeferredField(service.apiModel, (apiModel) =>
		onPatch({ apiModel }),
	);
	const nameField = useDeferredField(service.name, (name) => onPatch({ name }));

	const detectedModels = detection?.models ?? [];
	const modelOptions = useMemo(
		() =>
			detectedModels.map((model) => ({
				value: model.id,
				label: model.id,
			})),
		[detectedModels],
	);

	const subtitle =
		state === "error" ? (
			<div className="model-row-sub is-error">
				<ServiceStatusText detection={detection} checking={checking} />
			</div>
		) : (
			<div className="model-row-sub">
				{[hostOf(service.apiUri), service.apiModel].filter(Boolean).join(" · ")}
			</div>
		);

	return (
		<div className={`model-row${open ? " is-open" : ""}`}>
			{/* biome-ignore lint/a11y/useSemanticElements: the row hosts nested toggle buttons */}
			<div
				className="model-row-head"
				role="button"
				tabIndex={0}
				aria-expanded={open}
				onClick={() => onOpenChange(!open)}
				onKeyDown={(event) => {
					if (event.target !== event.currentTarget) {
						return;
					}
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						onOpenChange(!open);
					}
				}}
			>
				<Tooltip
					title={
						<ServiceStatusText detection={detection} checking={checking} />
					}
				>
					<span className={`model-dot is-${state}`} />
				</Tooltip>
				<div style={{ minWidth: 0 }}>
					<div className="model-row-title">
						<span>
							{service.name || service.apiModel || hostOf(service.apiUri)}
						</span>
						{detection && service.kind !== "deepl" && (
							<span className="model-badge">
								{PROVIDER_LABELS[detection.provider]}
							</span>
						)}
						{draft && (
							<span className="model-badge is-draft">
								<FormattedMessage id="workbench.models.draft" />
							</span>
						)}
					</div>
					{subtitle}
				</div>
				<UseChips
					service={service}
					availability={availability}
					defaults={{ chat: isDefaultChat, translation: isDefaultTranslation }}
					onToggle={onToggleUse}
					small
				/>
				<WorkbenchIcon name="chevronRight" className="model-row-chevron" />
			</div>

			{open && (
				<div className="model-editor">
					<div className="model-field">
						<label htmlFor={`${fieldId}-uri`}>
							<FormattedMessage id="workbench.models.field.uri" />
						</label>
						<div className="model-field-inline">
							<Input
								id={`${fieldId}-uri`}
								value={uriField.value}
								onChange={(event) => uriField.onChange(event.target.value)}
								onBlur={uriField.onBlur}
								onPressEnter={uriField.onPressEnter}
								spellCheck={false}
							/>
							<Tooltip
								title={<FormattedMessage id="workbench.models.recheck" />}
							>
								<Button
									type="text"
									icon={<WorkbenchIcon name="refresh" size={15} />}
									onClick={refresh}
									aria-label={intl.formatMessage({
										id: "workbench.models.recheck",
									})}
								/>
							</Tooltip>
						</div>
						<div className="model-field-hint">
							<ServiceStatusText detection={detection} checking={checking} />
						</div>
					</div>

					<div className="model-field">
						<label htmlFor={`${fieldId}-key`}>API Key</label>
						<Input.Password
							id={`${fieldId}-key`}
							value={keyField.value}
							onChange={(event) => keyField.onChange(event.target.value)}
							onBlur={keyField.onBlur}
							onPressEnter={keyField.onPressEnter}
							placeholder={intl.formatMessage({
								id: "workbench.models.field.keyPlaceholder",
							})}
							autoComplete="off"
						/>
					</div>

					{service.kind === "openai" && (
						<div className="model-field">
							<label htmlFor={`${fieldId}-model`}>
								<FormattedMessage id="workbench.models.field.model" />
							</label>
							<AutoComplete
								id={`${fieldId}-model`}
								value={modelField.value}
								options={modelOptions}
								onChange={(value) => modelField.onChange(value)}
								onSelect={(value) => {
									modelField.onChange(value);
									const detected = detectedModels.find(
										(model) => model.id === value,
									);
									onPatch({
										apiModel: value,
										...(detected
											? {
													supportThinking: detected.thinking,
													supportVision: detected.vision,
												}
											: {}),
									});
								}}
								onBlur={modelField.onBlur}
								filterOption={(input, option) =>
									(option?.value ?? "")
										.toLowerCase()
										.includes(input.toLowerCase())
								}
							/>
							{detectedModels.length > 0 && (
								<div className="model-field-hint">
									<FormattedMessage
										id="workbench.models.field.modelHint"
										values={{
											count: detectedModels.filter((model) =>
												isChatModel(model.id),
											).length,
										}}
									/>
								</div>
							)}
						</div>
					)}

					{service.kind === "openai" && (
						<div className="model-field">
							<span>
								<FormattedMessage id="workbench.models.field.capabilities" />
							</span>
							<div className="model-chips">
								<button
									type="button"
									className={`model-chip is-small${service.supportThinking ? " is-on" : ""}`}
									aria-pressed={service.supportThinking}
									onClick={() =>
										onPatch({ supportThinking: !service.supportThinking })
									}
								>
									<WorkbenchIcon name="bulb" size={12} />
									<FormattedMessage id="workbench.models.capability.thinking" />
								</button>
								<button
									type="button"
									className={`model-chip is-small${service.supportVision ? " is-on" : ""}`}
									aria-pressed={service.supportVision}
									onClick={() =>
										onPatch({ supportVision: !service.supportVision })
									}
								>
									<WorkbenchIcon name="eye" size={12} />
									<FormattedMessage id="workbench.models.capability.vision" />
								</button>
							</div>
							<div className="model-field-hint">
								<FormattedMessage id="workbench.models.field.capabilitiesHint" />
							</div>
						</div>
					)}

					{service.kind === "deepl" && (
						<div className="model-field">
							<span>
								<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.deeplPreferQualityOptimized" />
							</span>
							<div>
								<Switch
									checked={service.deeplPreferQualityOptimized}
									onChange={(checked) =>
										onPatch({ deeplPreferQualityOptimized: checked })
									}
								/>
							</div>
						</div>
					)}

					<div className="model-field">
						<label htmlFor={`${fieldId}-name`}>
							<FormattedMessage id="workbench.models.field.name" />
						</label>
						<Input
							id={`${fieldId}-name`}
							value={nameField.value}
							onChange={(event) => nameField.onChange(event.target.value)}
							onBlur={nameField.onBlur}
							onPressEnter={nameField.onPressEnter}
							style={{ fontFamily: "var(--snow-shot-font-ui)" }}
						/>
					</div>

					{(service.uses.chat || service.uses.translation) && (
						<div className="model-field">
							<span>
								<FormattedMessage id="workbench.models.default" />
							</span>
							<div className="model-chips">
								{service.uses.translation && (
									<Button
										size="small"
										disabled={isDefaultTranslation}
										onClick={onSetDefaultTranslation}
									>
										<FormattedMessage
											id={
												isDefaultTranslation
													? "workbench.models.isDefaultTranslation"
													: "workbench.models.setDefaultTranslation"
											}
										/>
									</Button>
								)}
								{service.uses.chat && (
									<Button
										size="small"
										disabled={isDefaultChat}
										onClick={onSetDefaultChat}
									>
										<FormattedMessage
											id={
												isDefaultChat
													? "workbench.models.isDefaultChat"
													: "workbench.models.setDefaultChat"
											}
										/>
									</Button>
								)}
							</div>
						</div>
					)}

					<div className="model-editor-footer">
						<ServiceTest service={service} />
						<Popconfirm
							title={<FormattedMessage id="workbench.models.removeConfirm" />}
							okButtonProps={{ danger: true }}
							onConfirm={onRemove}
						>
							<Button
								type="text"
								danger
								icon={<WorkbenchIcon name="trash" size={14} />}
							>
								<FormattedMessage id="workbench.models.remove" />
							</Button>
						</Popconfirm>
					</div>
				</div>
			)}
		</div>
	);
};
