export interface IframeModalAPI {
	dialog: any; // frappe.ui.Dialog
	iframe: HTMLIFrameElement | null;
	show(url: string, displayTitle?: string, originalDocName?: string): void;
	hide(): void;
}

export interface IframeViewModule {
	_create_fullscreen_modal(): IframeModalAPI;
	_open_doc_modal(doctype: string, docname: string): void;
}

declare module "@anygridtech/frappe-types/client/frappe" {
	interface Frappe {
		iframe_view: IframeViewModule;
	}
}

export {};
