"use client";

import { CloudDownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import {
	AutoComplete,
	Button,
	Form,
	type FormItemProps,
	Input,
	message,
	Space,
} from "antd";
import type React from "react";
import { useCallback, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { IconLabel } from "@/components/iconLable";
import { probeOpenAiCompatibleModels } from "@/services/tools/chat";

export interface ModelProbeInputProps {
	name: string | (string | number)[];
	label: React.ReactNode;
	tooltipTitle?: React.ReactNode;
	apiUri?: string;
	apiKey?: string;
	placeholder?: string;
	rules?: FormItemProps["rules"];
	required?: boolean;
}

export const ModelProbeInput: React.FC<ModelProbeInputProps> = ({
	name,
	label,
	tooltipTitle,
	apiUri,
	apiKey,
	placeholder,
	rules,
	required = false,
}) => {
	const intl = useIntl();
	const [probing, setProbing] = useState(false);
	const [probedModels, setProbedModels] = useState<string[]>([]);
	const form = Form.useFormInstance();

	const handleProbe = useCallback(async () => {
		if (!apiUri || !apiUri.trim()) {
			message.warning(
				intl.formatMessage({
					id: "settings.functionSettings.modelProbe.missingUri",
					defaultMessage: "请先填写 API 服务地址",
				}),
			);
			return;
		}

		setProbing(true);
		try {
			const res = await probeOpenAiCompatibleModels(apiUri, apiKey || "");
			if (res.models && res.models.length > 0) {
				setProbedModels(res.models);
				message.success(
					intl.formatMessage(
						{
							id: "settings.functionSettings.modelProbe.success",
							defaultMessage: "成功读取到 {count} 个可用模型",
						},
						{ count: res.models.length },
					),
				);

				const currentVal = form?.getFieldValue(name);
				if (!currentVal && res.models.length > 0 && form?.setFieldValue) {
					form.setFieldValue(name, res.models[0]);
				}
			} else {
				message.warning(
					res.errorMessage ||
						intl.formatMessage({
							id: "settings.functionSettings.modelProbe.empty",
							defaultMessage: "未读取到可用模型，请检查服务地址与运行状态",
						}),
				);
			}
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : `Unknown error: ${error}`;
			message.error(
				intl.formatMessage(
					{
						id: "settings.functionSettings.modelProbe.error",
						defaultMessage: "读取模型失败: {error}",
					},
					{ error: errorMsg },
				),
			);
		} finally {
			setProbing(false);
		}
	}, [apiUri, apiKey, form, intl, name]);

	const options = probedModels.map((m) => ({
		value: m,
		label: m,
	}));

	return (
		<Form.Item
			name={name}
			label={<IconLabel label={label} tooltipTitle={tooltipTitle} />}
			rules={
				rules ??
				(required
					? [
							{
								required: true,
								message: intl.formatMessage({
									id: "settings.functionSettings.translationSettings.apiConfig.apiModel.required",
									defaultMessage: "请输入模型名称",
								}),
							},
						]
					: undefined)
			}
		>
			<Space.Compact style={{ width: "100%" }}>
				<AutoComplete
					options={options}
					style={{ width: "100%" }}
					placeholder={
						placeholder ||
						intl.formatMessage({
							id: "settings.functionSettings.translationSettings.apiConfig.apiModel.placeholder",
							defaultMessage: "选择或输入模型名称，如 qwen2.5:7b",
						})
					}
					filterOption={(inputValue, option) =>
						(option?.value?.toUpperCase() ?? "").includes(
							inputValue.toUpperCase(),
						)
					}
				>
					<Input allowClear />
				</AutoComplete>
				<Button
					icon={probing ? <ReloadOutlined spin /> : <CloudDownloadOutlined />}
					loading={probing}
					onClick={handleProbe}
					title={intl.formatMessage({
						id: "settings.functionSettings.modelProbe.fetch",
						defaultMessage: "从服务地址读取模型列表",
					})}
				>
					<FormattedMessage
						id="settings.functionSettings.modelProbe.fetch"
						defaultMessage="读取模型"
					/>
				</Button>
			</Space.Compact>
		</Form.Item>
	);
};
