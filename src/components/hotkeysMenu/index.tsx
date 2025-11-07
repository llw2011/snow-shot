import { Button, Dropdown } from "antd";
import type React from "react";
import { KeyboardIcon } from "../icons";

export const HotkeysMenu: React.FC<{
	menu: React.ComponentProps<typeof Dropdown>["menu"];
	className?: string;
}> = ({ menu, className }) => {
	return (
		<div className={`component-hotkeys-menu ${className}`}>
			<Dropdown
				menu={menu}
				arrow={{
					pointAtCenter: true,
				}}
				placement="topRight"
			>
				<Button
					className="hotkeys-menu-button"
					icon={<KeyboardIcon />}
					shape="circle"
				/>
			</Dropdown>

			<style jsx>{`
                .component-hotkeys-menu {
                    display: inline-block;
                }

                :global(.component-hotkeys-menu .hotkeys-menu-button) {
                    opacity: 0.42;
                }

                :global(.component-hotkeys-menu .hotkeys-menu-button:hover) {
                    opacity: 1;
                }
            `}</style>
		</div>
	);
};
