import { Spin } from "antd";
import { useCallback, useContext, useMemo, useState } from "react";
import { FormattedMessage } from "react-intl";
import { SettingsGroup } from "@/components/settingsGroup";
import {
	PLUGIN_ID_AI_CHAT,
	PLUGIN_ID_GLM_OCR,
	PLUGIN_ID_TRANSLATE,
} from "@/constants/pluginService";
import { AntdContext } from "@/contexts/antdContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { AddService } from "./addService";
import {
	hasAnyUse,
	type ModelService,
	type ModelServiceUses,
	setServiceUse,
	updateService,
} from "./serviceModel";
import { ServiceRow, type UseAvailability } from "./serviceRow";
import { useModelServices } from "./useModelServices";
import "./modelServices.css";

/**
 * One place for every model endpoint. A service is added once and assigned to
 * chat, translation and/or OCR; the underlying per-feature lists are derived.
 */
export const ModelServicesSection = () => {
	const { message } = useContext(AntdContext);
	const { isReadyStatus } = usePluginServiceContext();
	const {
		loading,
		services,
		commit,
		isDefaultChat,
		isDefaultTranslation,
		setDefaultChat,
		setDefaultTranslation,
	} = useModelServices();

	const availability = useMemo<UseAvailability>(
		() => ({
			chat: !!isReadyStatus?.(PLUGIN_ID_AI_CHAT),
			translation: !!isReadyStatus?.(PLUGIN_ID_TRANSLATE),
			ocr: !!isReadyStatus?.(PLUGIN_ID_GLM_OCR),
		}),
		[isReadyStatus],
	);

	// Services without any use are not persisted by the feature lists; keep
	// them visible here until they are assigned or removed.
	const [drafts, setDrafts] = useState<ModelService[]>([]);
	const [openKey, setOpenKey] = useState<string>();

	const visibleDrafts = drafts.filter(
		(draft) => !services.some((service) => service.key === draft.key),
	);

	const addService = useCallback(
		(service: ModelService) => {
			if (services.some((item) => item.key === service.key)) {
				setOpenKey(service.key);
				return;
			}
			if (hasAnyUse(service)) {
				commit([...services, service]);
			} else {
				setDrafts((previous) => [...previous, service]);
			}
			setOpenKey(service.key);
			message.success(<FormattedMessage id="workbench.models.added" />);
		},
		[commit, message, services],
	);

	const patchService = (
		service: ModelService,
		isDraft: boolean,
		patch: Partial<Omit<ModelService, "key" | "uses">>,
	) => {
		if (isDraft) {
			const result = updateService(drafts, service.key, patch);
			setDrafts(result.services);
			if (openKey === service.key) {
				setOpenKey(result.key);
			}
			return;
		}

		const result = updateService(services, service.key, patch);
		commit(result.services);
		if (openKey === service.key) {
			setOpenKey(result.key);
		}
	};

	const toggleUse = (
		service: ModelService,
		isDraft: boolean,
		use: keyof ModelServiceUses,
		enabled: boolean,
	) => {
		if (isDraft) {
			const next = { ...service, uses: { ...service.uses, [use]: enabled } };
			setDrafts((previous) =>
				previous.filter((item) => item.key !== service.key),
			);
			commit(setServiceUse([...services, next], next.key, use, enabled));
			return;
		}

		const nextServices = setServiceUse(services, service.key, use, enabled);
		const updated = nextServices.find((item) => item.key === service.key);
		if (updated && !hasAnyUse(updated)) {
			setDrafts((previous) => [...previous, updated]);
		}
		commit(nextServices);
	};

	const removeService = (service: ModelService, isDraft: boolean) => {
		setDrafts((previous) =>
			previous.filter((item) => item.key !== service.key),
		);
		if (!isDraft) {
			commit(services.filter((item) => item.key !== service.key));
		}
	};

	const rows = [
		...services.map((service) => ({ service, draft: false })),
		...visibleDrafts.map((service) => ({ service, draft: true })),
	];

	return (
		<>
			<SettingsGroup
				title={<FormattedMessage id="workbench.models.addTitle" />}
				rows={false}
			>
				<AddService
					services={[...services, ...visibleDrafts]}
					availability={availability}
					onAdd={addService}
				/>
			</SettingsGroup>

			<SettingsGroup
				title={<FormattedMessage id="workbench.models.listTitle" />}
				description={<FormattedMessage id="workbench.models.listDescription" />}
				rows={false}
			>
				<Spin spinning={loading}>
					<div className="model-table">
						{rows.length === 0 ? (
							<div className="model-empty">
								<FormattedMessage id="workbench.models.empty" />
							</div>
						) : (
							rows.map(({ service, draft }, index) => (
								<ServiceRow
									// Edits change the service identity; a positional key keeps the
									// editor (and its focused input) mounted while typing.
									key={`${draft ? "draft" : "service"}-${index}`}
									service={service}
									draft={draft}
									open={openKey === service.key}
									availability={availability}
									isDefaultChat={!draft && isDefaultChat(service)}
									isDefaultTranslation={!draft && isDefaultTranslation(service)}
									onOpenChange={(open) =>
										setOpenKey(open ? service.key : undefined)
									}
									onPatch={(patch) => patchService(service, draft, patch)}
									onToggleUse={(use, enabled) =>
										toggleUse(service, draft, use, enabled)
									}
									onSetDefaultChat={() => setDefaultChat(service)}
									onSetDefaultTranslation={() => setDefaultTranslation(service)}
									onRemove={() => removeService(service, draft)}
								/>
							))
						)}
					</div>
				</Spin>
			</SettingsGroup>
		</>
	);
};
