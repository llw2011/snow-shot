import { useContext, useMemo } from "react";
import { FormattedMessage } from "react-intl";
import { GlobalShortcutContext } from "@/components/globalShortcut";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import { ShortcutEditor, useShortcutInfo } from "@/components/shortcutEditor";
import { WorkbenchIcon } from "@/components/workbench/icons";
import {
	useVisibleWorkbenchItems,
	WORKBENCH_SECTIONS,
	type WorkbenchItem,
} from "@/components/workbench/registry";
import { AppSettingsGroup } from "@/types/appSettings";
import { AppFunctionGroup } from "@/types/components/appFunction";
import { SettingsLine } from "../shared/settingsLine";

const ShortcutRow: React.FC<{
	item: WorkbenchItem;
	group: AppFunctionGroup;
}> = ({ item, group }) => {
	const appFunction = item.appFunction;
	// biome-ignore lint/style/noNonNullAssertion: rows are only built for items with a function
	const { state, statusMessageId } = useShortcutInfo(appFunction!);

	return (
		<SettingsLine
			label={
				<span className="shortcut-row-label">
					<WorkbenchIcon name={item.icon} />
					<FormattedMessage id={item.titleId} />
				</span>
			}
			hint={
				statusMessageId && (state === "warning" || state === "error") ? (
					<span className={`shortcut-row-status is-${state}`}>
						<FormattedMessage id={statusMessageId} />
					</span>
				) : undefined
			}
			control={
				<ShortcutEditor
					// biome-ignore lint/style/noNonNullAssertion: see above
					appFunction={appFunction!}
					group={group}
					title={<FormattedMessage id={item.titleId} />}
				/>
			}
		/>
	);
};

/** Every global shortcut in one table, grouped like the navigator. */
export const GlobalShortcutsSection = () => {
	const items = useVisibleWorkbenchItems();
	const { appFunctionSettings } = useContext(GlobalShortcutContext);

	const sections = useMemo(
		() =>
			WORKBENCH_SECTIONS.map((section) => ({
				section,
				items: items.filter(
					(item) => item.section === section && item.appFunction,
				),
			})).filter(({ items }) => items.length > 0),
		[items],
	);

	return (
		<>
			{sections.map(({ section, items }, index) => (
				<SettingsGroup
					key={section}
					title={<FormattedMessage id={`workbench.section.${section}`} />}
					extra={
						index === 0 ? (
							<ResetSettingsButton
								title={
									<FormattedMessage id="workbench.group.globalShortcuts" />
								}
								appSettingsGroup={AppSettingsGroup.AppFunction}
							/>
						) : undefined
					}
					rows={false}
				>
					{items.map((item) => (
						<ShortcutRow
							key={item.id}
							item={item}
							group={
								// biome-ignore lint/style/noNonNullAssertion: filtered above
								appFunctionSettings?.[item.appFunction!]?.group ??
								AppFunctionGroup.Other
							}
						/>
					))}
				</SettingsGroup>
			))}
			<style jsx global>{`
				.shortcut-row-label {
					display: inline-flex;
					align-items: center;
					gap: 10px;
				}

				.shortcut-row-label .wb-icon {
					color: var(--snow-shot-muted);
				}

				.shortcut-row-status {
					padding-left: 26px;
				}

				.shortcut-row-status.is-warning {
					color: var(--snow-shot-yellow);
				}

				.shortcut-row-status.is-error {
					color: var(--snow-shot-red);
				}
			`}</style>
		</>
	);
};
