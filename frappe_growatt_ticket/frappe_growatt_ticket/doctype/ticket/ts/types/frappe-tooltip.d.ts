import type { FrappeForm } from "@anygridtech/frappe-types/client/frappe/core";

export interface TooltipModule {
	showUserTips(opts: {
		form?: FrappeForm;
		doctype: string;
		docnames: string | string[];
	}): Promise<void>;
}

declare module "@anygridtech/frappe-types/client/frappe" {
	interface Frappe {
		tooltip: TooltipModule;
	}
}

export {};
