import { Button, Dropdown } from "antd";
import type React from "react";
import { KeyboardIcon } from "../icons";

export const HotkeysMenu: React.FC<{
	menu: React.ComponentProps<typeof Dropdown>["menu"];
	className?: string;
	/** "toolbar" sits in a header and opens downwards. */
	variant?: "floating" | "toolbar";
}> = ({ menu, className, variant = "floating" }) => {
	const isToolbar = variant === "toolbar";
	return (
		<div className={`component-hotkeys-menu ${className ?? ""}`}>
			<Dropdown
				menu={menu}
				arrow={{
					pointAtCenter: true,
				}}
				placement={isToolbar ? "bottomRight" : "topRight"}
			>
				<Button
					className="hotkeys-menu-button"
					icon={<KeyboardIcon />}
					shape={isToolbar ? "default" : "circle"}
					type={isToolbar ? "text" : "default"}
				/>
			</Dropdown>

			<style jsx>{`
                .component-hotkeys-menu {
                    display: inline-block;
                }

                :global(.component-hotkeys-menu .hotkeys-menu-button) {
                    color: var(--snow-shot-muted);
                }

                :global(.component-hotkeys-menu .hotkeys-menu-button:hover) {
                    color: var(--snow-shot-ink);
                }
            `}</style>
		</div>
	);
};
