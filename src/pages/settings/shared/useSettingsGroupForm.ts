import { Form, type FormInstance } from "antd";
import { useCallback, useContext, useRef, useState } from "react";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import type { AppSettingsData, AppSettingsGroup } from "@/types/appSettings";

export type SettingsSaveOptions = {
	/** Broadcast the change to the other windows (draw, fixed content, …). */
	syncAllWindow?: boolean;
	/** Skip the React state update of the settings provider. */
	ignoreState?: boolean;
	ignorePublisher?: boolean;
};

/**
 * Binds one antd form to one persisted settings group.
 *
 * The form is refreshed whenever the stored group changes (reset, another
 * window, migration) and `save` writes partial values back immediately, so a
 * settings view can unmount at any time without losing edits.
 */
export const useSettingsGroupForm = <G extends AppSettingsGroup>(
	group: G,
	options?: SettingsSaveOptions & {
		onLoad?: (
			settings: AppSettingsData,
			form: FormInstance<AppSettingsData[G]>,
		) => void;
	},
) => {
	const [form] = Form.useForm<AppSettingsData[G]>();
	const [loading, setLoading] = useState(true);
	const { updateAppSettings } = useContext(AppSettingsActionContext);

	const onLoadRef = useRef(options?.onLoad);
	onLoadRef.current = options?.onLoad;

	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData, preSettings?: AppSettingsData) => {
				setLoading(false);

				if (
					preSettings === undefined ||
					preSettings[group] !== settings[group]
				) {
					// biome-ignore lint/suspicious/noExplicitAny: antd's recursive partial type does not accept the group union
					form.setFieldsValue(settings[group] as any);
					onLoadRef.current?.(settings, form);
				}
			},
			[form, group],
		),
		true,
	);

	const syncAllWindow = options?.syncAllWindow ?? true;
	const ignoreState = options?.ignoreState ?? true;
	const ignorePublisher = options?.ignorePublisher ?? false;
	const save = useCallback(
		(values: Partial<AppSettingsData[G]>) => {
			updateAppSettings(
				group,
				values,
				true,
				true,
				syncAllWindow,
				ignoreState,
				ignorePublisher,
			);
		},
		[group, ignorePublisher, ignoreState, syncAllWindow, updateAppSettings],
	);

	return { form, loading, save };
};
