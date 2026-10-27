import { EllipsisOutlined } from "@ant-design/icons";
import * as dialog from "@tauri-apps/plugin-dialog";
import { Button, Input, Space } from "antd";
import { useCallback } from "react";
import { useIntl } from "react-intl";
import "@/components/pathInput/pathInput.css";

export const DirectoryInput: React.FC<{
	value?: string;
	onChange?: (value: string) => void;
	disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
	const intl = useIntl();
	const selectPath = useCallback(async () => {
		const filePath = await dialog.open({
			directory: true,
			defaultPath: value,
		});

		if (filePath) {
			onChange?.(filePath);
		}
	}, [value, onChange]);

	const browseLabel = intl.formatMessage({ id: "workbench.browse" });

	return (
		<Space.Compact className="directory-input" block>
			<Input
				disabled={disabled}
				allowClear
				value={value}
				onChange={(e) => {
					onChange?.(e.target.value);
				}}
			/>
			<Button
				disabled={disabled}
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
