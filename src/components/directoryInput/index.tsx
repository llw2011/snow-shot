import { EllipsisOutlined } from "@ant-design/icons";
import * as dialog from "@tauri-apps/plugin-dialog";
import { Button, Input } from "antd";
import { useCallback } from "react";

export const DirectoryInput: React.FC<{
	value?: string;
	onChange?: (value: string) => void;
	disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
	const selectPath = useCallback(async () => {
		const filePath = await dialog.open({
			directory: true,
			defaultPath: value,
		});

		if (filePath) {
			onChange?.(filePath);
		}
	}, [value, onChange]);

	return (
		<Input.Search
			disabled={disabled}
			enterButton={
				<Button
					disabled={disabled}
					onClick={() => {
						selectPath();
					}}
					type="default"
					icon={<EllipsisOutlined />}
				/>
			}
			allowClear
			value={value}
			onChange={(e) => {
				onChange?.(e.target.value);
			}}
		/>
	);
};
