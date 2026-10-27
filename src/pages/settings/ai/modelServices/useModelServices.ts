import { isEqual } from "es-toolkit";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PLUGIN_ID_RAPID_OCR } from "@/constants/pluginService";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { AppSettingsGroup, OcrModel } from "@/types/appSettings";
import { useAppSettingsSnapshot } from "../../shared/hooks";
import { detectService, type ServiceDetection } from "./detection";
import {
	applyModelServices,
	deriveModelServices,
	getServiceModelType,
	type ModelService,
	type ModelServiceStorage,
} from "./serviceModel";

/** Persisted model services plus the defaults that point at them. */
export const useModelServices = () => {
	const settings = useAppSettingsSnapshot();
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const { isReadyStatus } = usePluginServiceContext();

	const chatSettings = settings?.[AppSettingsGroup.FunctionChat];
	const translationSettings = settings?.[AppSettingsGroup.FunctionTranslation];
	const ocrSettings = settings?.[AppSettingsGroup.FunctionOcr];

	const storage = useMemo((): ModelServiceStorage | undefined => {
		if (!chatSettings || !translationSettings || !ocrSettings) {
			return undefined;
		}
		return {
			chatApiConfigList: chatSettings.chatApiConfigList,
			translationApiConfigList: translationSettings.translationApiConfigList,
			glmOcrApiConfig: ocrSettings.glmOcrApiConfig,
			ocrModel: ocrSettings.ocrModel,
		};
	}, [chatSettings, translationSettings, ocrSettings]);

	const services = useMemo(
		() => (storage ? deriveModelServices(storage) : []),
		[storage],
	);

	const commit = useCallback(
		(next: ModelService[]) => {
			if (!storage) {
				return;
			}

			const applied = applyModelServices(
				next,
				storage,
				isReadyStatus?.(PLUGIN_ID_RAPID_OCR)
					? OcrModel.RapidOcrV4
					: storage.ocrModel,
			);

			if (!isEqual(applied.chatApiConfigList, storage.chatApiConfigList)) {
				updateAppSettings(
					AppSettingsGroup.FunctionChat,
					{ chatApiConfigList: applied.chatApiConfigList },
					true,
					true,
					true,
					true,
					false,
				);
			}
			if (
				!isEqual(
					applied.translationApiConfigList,
					storage.translationApiConfigList,
				)
			) {
				updateAppSettings(
					AppSettingsGroup.FunctionTranslation,
					{ translationApiConfigList: applied.translationApiConfigList },
					true,
					true,
					true,
					true,
					false,
				);
			}
			if (
				!isEqual(applied.glmOcrApiConfig, storage.glmOcrApiConfig) ||
				applied.ocrModel !== storage.ocrModel
			) {
				updateAppSettings(
					AppSettingsGroup.FunctionOcr,
					{
						glmOcrApiConfig: applied.glmOcrApiConfig,
						ocrModel: applied.ocrModel,
					},
					true,
					true,
					true,
					true,
					false,
				);
			}
		},
		[isReadyStatus, storage, updateAppSettings],
	);

	const defaultTranslationType = translationSettings?.translationType;
	const defaultChatModel = settings?.[AppSettingsGroup.Cache].chatModel;

	const setDefaultTranslation = useCallback(
		(service: ModelService) => {
			updateAppSettings(
				AppSettingsGroup.FunctionTranslation,
				{ translationType: getServiceModelType(service) },
				true,
				true,
				true,
				true,
				false,
			);
		},
		[updateAppSettings],
	);

	const setDefaultChat = useCallback(
		(service: ModelService) => {
			updateAppSettings(
				AppSettingsGroup.Cache,
				{ chatModel: getServiceModelType(service) },
				false,
				true,
				true,
				true,
				false,
			);
		},
		[updateAppSettings],
	);

	return {
		loading: !storage,
		services,
		commit,
		isDefaultTranslation: (service: ModelService) =>
			service.uses.translation &&
			defaultTranslationType === getServiceModelType(service),
		isDefaultChat: (service: ModelService) =>
			service.uses.chat && defaultChatModel === getServiceModelType(service),
		setDefaultTranslation,
		setDefaultChat,
	};
};

// Connection checks are cached for the app session so reopening the page does
// not hammer remote APIs; "refresh" forces a new check.
const statusCache = new Map<string, Promise<ServiceDetection | undefined>>();

const statusKey = (service: Pick<ModelService, "apiUri" | "apiKey">) =>
	`${service.apiUri.trim()}\u0000${service.apiKey.trim()}`;

export const useServiceStatus = (
	service: Pick<ModelService, "apiUri" | "apiKey"> | undefined,
) => {
	const [detection, setDetection] = useState<ServiceDetection>();
	const [checking, setChecking] = useState(false);
	const [version, setVersion] = useState(0);
	const key = service ? statusKey(service) : undefined;

	// biome-ignore lint/correctness/useExhaustiveDependencies: the key captures the endpoint and credentials
	useEffect(() => {
		if (!service || !key || !service.apiUri.trim()) {
			setDetection(undefined);
			return;
		}

		let canceled = false;
		let pending = statusCache.get(key);
		if (!pending || version > 0) {
			pending = detectService(service.apiUri, service.apiKey);
			statusCache.set(key, pending);
		}

		setChecking(true);
		pending.then((result) => {
			if (!canceled) {
				setDetection(result);
				setChecking(false);
			}
		});

		return () => {
			canceled = true;
		};
	}, [key, version]);

	return {
		detection,
		checking,
		refresh: useCallback(() => setVersion((value) => value + 1), []),
	};
};
