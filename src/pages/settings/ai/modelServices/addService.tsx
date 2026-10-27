import { Button, Input } from "antd";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { WorkbenchIcon } from "@/components/workbench/icons";
import {
	type DetectedModel,
	type DiscoveredService,
	detectService,
	isChatModel,
	normalizeServiceInput,
	PROVIDER_LABELS,
	type ServiceDetection,
	scanLocalServices,
	suggestServiceName,
} from "./detection";
import {
	getModelServiceKey,
	type ModelService,
	type ModelServiceUses,
	normalizeServiceUri,
} from "./serviceModel";
import { type UseAvailability, UseChips } from "./serviceRow";
import { ServiceStatusText } from "./serviceStatus";

/** Uses a freshly detected model is most likely meant for. */
export const suggestUses = (
	provider: ServiceDetection["provider"],
	model: DetectedModel | undefined,
	availability: UseAvailability,
): ModelServiceUses => {
	if (provider === "deepl") {
		return { chat: false, translation: availability.translation, ocr: false };
	}
	if (model && /ocr/i.test(model.id) && model.vision) {
		return { chat: false, translation: false, ocr: availability.ocr };
	}
	return {
		chat: availability.chat,
		translation: availability.translation,
		ocr: false,
	};
};

// Local runtimes are scanned once per session when the page first opens.
let localScanPromise: Promise<DiscoveredService[]> | undefined;

const useLocalDiscovery = () => {
	const [discovered, setDiscovered] = useState<DiscoveredService[]>([]);
	const [scanning, setScanning] = useState(false);

	const scan = (force: boolean) => {
		if (!localScanPromise || force) {
			localScanPromise = scanLocalServices();
		}
		setScanning(true);
		const pending = localScanPromise;
		pending
			.then((result) => {
				if (pending === localScanPromise) {
					setDiscovered(result);
				}
			})
			.finally(() => setScanning(false));
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: scan once on mount
	useEffect(() => {
		scan(false);
	}, []);

	return { discovered, scanning, rescan: () => scan(true) };
};

export const AddService: React.FC<{
	services: ModelService[];
	availability: UseAvailability;
	onAdd: (service: ModelService) => void;
}> = ({ services, availability, onAdd }) => {
	const intl = useIntl();
	const [uriInput, setUriInput] = useState("");
	const [keyInput, setKeyInput] = useState("");
	const [detection, setDetection] = useState<ServiceDetection>();
	const [detecting, setDetecting] = useState(false);
	const [selectedModel, setSelectedModel] = useState<string>();
	const [uses, setUses] = useState<ModelServiceUses>({
		chat: false,
		translation: false,
		ocr: false,
	});
	const { discovered, scanning, rescan } = useLocalDiscovery();
	const availabilityRef = useRef(availability);
	availabilityRef.current = availability;

	// Detect while typing, but only for the latest input.
	const requestRef = useRef(0);
	useEffect(() => {
		const normalized = normalizeServiceInput(uriInput);
		if (!normalized) {
			setDetection(undefined);
			setDetecting(false);
			return;
		}

		const requestId = ++requestRef.current;
		const abortController = new AbortController();
		setDetecting(true);
		const timer = setTimeout(() => {
			detectService(uriInput, keyInput, {
				signal: abortController.signal,
			}).then((result) => {
				if (requestId !== requestRef.current) {
					return;
				}
				setDetection(result);
				setDetecting(false);
				const firstModel = result?.models.find((model) =>
					isChatModel(model.id),
				);
				setSelectedModel(firstModel?.id ?? result?.models[0]?.id);
				if (result) {
					setUses(
						suggestUses(result.provider, firstModel, availabilityRef.current),
					);
				}
			});
		}, 600);

		return () => {
			clearTimeout(timer);
			abortController.abort();
		};
	}, [keyInput, uriInput]);

	const model = detection?.models.find((item) => item.id === selectedModel);
	const normalized = normalizeServiceInput(uriInput);
	const isDeepL = detection?.provider === "deepl";

	const draftService = useMemo((): ModelService | undefined => {
		if (!normalized) {
			return undefined;
		}
		const provider = detection?.provider ?? normalized.provider;
		const service: ModelService = {
			key: "",
			kind: provider === "deepl" ? "deepl" : "openai",
			name: suggestServiceName(provider, selectedModel ?? ""),
			apiUri: detection?.apiUri ?? normalized.apiUri,
			apiKey: keyInput.trim(),
			apiModel: provider === "deepl" ? "" : (selectedModel ?? ""),
			supportThinking: !!model?.thinking,
			supportVision: !!model?.vision,
			deeplPreferQualityOptimized: false,
			uses,
		};
		service.key = getModelServiceKey(service);
		return service;
	}, [detection, keyInput, model, normalized, selectedModel, uses]);

	const canAdd =
		!!draftService &&
		(draftService.kind === "deepl" || !!draftService.apiModel);
	const alreadyAdded =
		!!draftService &&
		services.some((service) => service.key === draftService.key);

	const knownUris = useMemo(
		() =>
			new Set(services.map((service) => normalizeServiceUri(service.apiUri))),
		[services],
	);
	const newDiscoveries = discovered.filter(
		(item) => !knownUris.has(normalizeServiceUri(item.apiUri)),
	);

	const reset = () => {
		setUriInput("");
		setKeyInput("");
		setDetection(undefined);
		setSelectedModel(undefined);
	};

	return (
		<div className="model-add">
			<div className="model-add-inputs">
				<Input
					value={uriInput}
					onChange={(event) => setUriInput(event.target.value)}
					placeholder={intl.formatMessage({
						id: "workbench.models.add.uriPlaceholder",
					})}
					aria-label={intl.formatMessage({ id: "workbench.models.field.uri" })}
					spellCheck={false}
					allowClear
				/>
				<Input.Password
					value={keyInput}
					onChange={(event) => setKeyInput(event.target.value)}
					placeholder={intl.formatMessage({
						id: "workbench.models.field.keyPlaceholder",
					})}
					aria-label="API Key"
					autoComplete="off"
				/>
				<Button
					type="primary"
					icon={<WorkbenchIcon name="plus" size={14} />}
					disabled={!canAdd || alreadyAdded}
					onClick={() => {
						if (draftService && canAdd) {
							onAdd(draftService);
							reset();
						}
					}}
				>
					<FormattedMessage id="workbench.models.add" />
				</Button>
			</div>

			{normalized && (
				<div className="model-summary">
					<span className="model-summary-label">
						<FormattedMessage id="workbench.models.summary.endpoint" />
					</span>
					<span
						className="model-summary-value"
						style={{ fontFamily: "var(--snow-shot-font-mono)", fontSize: 12.5 }}
					>
						{detection?.apiUri ?? normalized.apiUri}
					</span>

					<span className="model-summary-label">
						<FormattedMessage id="workbench.models.summary.connection" />
					</span>
					<span className="model-summary-value">
						<ServiceStatusText detection={detection} checking={detecting} />
					</span>

					{!isDeepL && detection && detection.models.length > 0 && (
						<>
							<span className="model-summary-label">
								<FormattedMessage id="workbench.models.field.model" />
							</span>
							<div className="model-chips">
								{detection.models.slice(0, 12).map((item) => (
									<button
										key={item.id}
										type="button"
										className={`model-chip is-mono is-small${item.id === selectedModel ? " is-on" : ""}`}
										aria-pressed={item.id === selectedModel}
										onClick={() => {
											setSelectedModel(item.id);
											setUses(
												suggestUses(detection.provider, item, availability),
											);
										}}
									>
										{item.id}
										{item.vision && (
											<span className="model-chip-tag">
												<FormattedMessage id="workbench.models.capability.vision" />
											</span>
										)}
									</button>
								))}
							</div>
						</>
					)}

					{draftService && detection?.status === "ok" && (
						<>
							<span className="model-summary-label">
								<FormattedMessage id="workbench.models.summary.uses" />
							</span>
							<UseChips
								service={draftService}
								availability={availability}
								onToggle={(use, enabled) =>
									setUses((previous) => ({ ...previous, [use]: enabled }))
								}
								small
							/>
						</>
					)}
				</div>
			)}

			{alreadyAdded && (
				<p className="model-hint">
					<FormattedMessage id="workbench.models.add.duplicate" />
				</p>
			)}

			{newDiscoveries.length > 0 && !normalized && (
				<div className="model-discovery">
					{newDiscoveries.map((item) => (
						<div className="model-discovery-item" key={item.apiUri}>
							<WorkbenchIcon name="radar" />
							<span>
								<FormattedMessage
									id="workbench.models.discovered"
									values={{
										provider: (
											<b key="provider">{PROVIDER_LABELS[item.provider]}</b>
										),
										host: `127.0.0.1:${item.port}`,
										count: item.models.length,
									}}
								/>
							</span>
							<Button
								size="small"
								type="primary"
								onClick={() => {
									setKeyInput("");
									setUriInput(item.apiUri);
								}}
							>
								<FormattedMessage id="workbench.models.use" />
							</Button>
						</div>
					))}
				</div>
			)}

			<p className="model-hint">
				<FormattedMessage id="workbench.models.add.hint" />{" "}
				<Button
					type="link"
					size="small"
					loading={scanning}
					onClick={rescan}
					style={{ padding: 0, height: "auto" }}
				>
					<FormattedMessage id="workbench.models.scan" />
				</Button>
			</p>
		</div>
	);
};
