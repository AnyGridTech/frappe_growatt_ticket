frappe.provide("frappe_growatt_ticket.setup");
declare var frappe_growatt_ticket: any;
frappe_growatt_ticket.setup = {
  run: async (form: any) => {
    if (!frappe_growatt_ticket) return;
    frappe_growatt_ticket.src_form = cur_frm;

    await agt.corrections_tracker.run.run();
    if (!(globalThis as any).workflow_preactions) {
      (globalThis as any).workflow_preactions = {};
    }
    frappe.ui.form.on(form.doctype, 'before_workflow_action', async () => {
      await agt.workflow.validate();
      await agt.workflow.pre_action();
    });
    frappe.ui.form.on(form.doctype, 'refresh', async () => {
      // await agt.workflow.load_history_field();
    });
    frappe.ui.form.on(form.doctype, 'after_save', async () => {
      await agt.workflow.validate("SAVE");
    });
    frappe.ui.form.on(form.doctype, 'onload', async () => {
      await agt.workflow.validate("LOAD");
    })
  }
}

