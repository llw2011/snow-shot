import { AntdContextProvider } from "../antdContextProvider";
import { AppSettingsContextProvider } from "../appSettingsContextProvider";
import { EventListener } from "../eventListener";
import { FetchErrorHandler } from "../fetchErrorHandler";
import { PluginServiceContextProvider } from "../pluginServiceContextProvider";

export const RouterContainer: React.FC<{
	children: React.ReactNode;
	autoInitPlugin: boolean;
}> = ({ children, autoInitPlugin }) => {
	return (
		<PluginServiceContextProvider autoInit={autoInitPlugin}>
			<AppSettingsContextProvider>
				<AntdContextProvider>
					<FetchErrorHandler>
						<EventListener>{children}</EventListener>
					</FetchErrorHandler>
				</AntdContextProvider>
			</AppSettingsContextProvider>
		</PluginServiceContextProvider>
	);
};
