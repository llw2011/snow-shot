import type React from "react";
import { FormattedMessage } from "react-intl";
import { WorkbenchIcon } from "@/components/workbench/icons";
import { PROVIDER_LABELS, type ServiceDetection } from "./detection";

export type DetectionState = "ok" | "warning" | "error" | "checking";

export const getDetectionState = (
	detection: ServiceDetection | undefined,
	checking: boolean,
): DetectionState => {
	if (checking || !detection) {
		return "checking";
	}
	switch (detection.status) {
		case "ok":
			return "ok";
		case "empty":
		case "notFound":
			return "warning";
		default:
			return "error";
	}
};

/** One line that says whether the endpoint answers and how. */
export const ServiceStatusText: React.FC<{
	detection: ServiceDetection | undefined;
	checking: boolean;
	showProvider?: boolean;
}> = ({ detection, checking, showProvider = true }) => {
	const state = getDetectionState(detection, checking);

	if (state === "checking") {
		return (
			<span className="model-status is-checking">
				<span className="model-dot is-checking" />
				<FormattedMessage id="workbench.models.status.checking" />
			</span>
		);
	}

	// biome-ignore lint/style/noNonNullAssertion: "checking" covers the undefined case
	const result = detection!;
	const provider = showProvider ? ` · ${PROVIDER_LABELS[result.provider]}` : "";

	return (
		<span className={`model-status is-${state}`}>
			<WorkbenchIcon name={state === "ok" ? "check" : "info"} size={14} />
			<FormattedMessage
				id={
					result.status === "ok" && result.provider === "deepl"
						? "workbench.models.status.okDeepl"
						: `workbench.models.status.${result.status}`
				}
				values={{
					ms: result.latencyMs ?? 0,
					count: result.models.length,
					code: result.httpStatus ?? "",
				}}
			/>
			{provider}
		</span>
	);
};
