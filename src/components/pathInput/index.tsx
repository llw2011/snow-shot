import { EllipsisOutlined } from "@ant-design/icons";
import * as dialog from "@tauri-apps/plugin-dialog";
import { Button, Input, Space } from "antd";
import { useCallback } from "react";
import { useIntl } from "react-intl";
import "./pathInput.css";

export const PathInput: React.FC<{
	value?: string;
	onChange?: (value: string) => void;
	filters: dialog.DialogFilter[];
	placeholder?: string;
}> = ({ value, onChange, filters, placeholder }) => {
	const intl = useIntl();
	const selectPath = useCallback(async () => {
		const filePath = await dialog.open({
			filters,
			defaultPath: value,
		});

		if (filePath) {
			onChange?.(filePath);
		}
	}, [value, onChange, filters]);

	const browseLabel = intl.formatMessage({ id: "workbench.browse" });

	return (
		<Space.Compact className="path-input" block>
			<Input
				placeholder={placeholder}
				allowClear
				value={value}
				onChange={(e) => {
					onChange?.(e.target.value);
				}}
			/>
			<Button
				aria-label={browseLabel}
				title={browseLabel}
				icon={<EllipsisOutlined />}
				onClick={() => {
					selectPath();
				}}
			/>
		</Space.Compact>
	);
};
