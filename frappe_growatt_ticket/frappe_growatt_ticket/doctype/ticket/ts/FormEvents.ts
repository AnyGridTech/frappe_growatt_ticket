/// <reference path="./types/frappe-tooltip.d.ts" />

import { SerialNo, InitialAnalysis, Ticket } from "@anygridtech/frappe-agt-types/agt/doctype";
import type { FrappeForm } from "@anygridtech/frappe-types/client/frappe/core";
import { ticket_utils } from "./Utils";
import { sub_workflow } from "./SubWorkflow";
import "./Setup";

declare var frappe_growatt_ticket: any;

/*
* This file handles the form events for the Ticket doctype.
* Read more: https://docs.frappe.io/framework/user/en/api/form#form-events
*/

frappe.ui.form.on("Ticket", {
  setup: async (form: FrappeForm<Ticket>) => {
    if (form.doc.main_eqp_serial_no) {
      agt.utils.validate_serial_number(form.doc.main_eqp_serial_no);
    }
    // await agt.setup.run();
    await frappe_growatt_ticket.setup.run(form);
    ticket_utils.fields_listener(form);
  },
  before_save: async (form: FrappeForm<Ticket>) => {
    if (!form.doc?.main_eqp_serial_no) {
      frappe.throw(__("Serial number required."));
    } else if (!agt.utils.validate_serial_number(form.doc?.main_eqp_serial_no)) {
      frappe.throw(__("Invalid serial number."));
    }
    await ticket_utils.share_doc_trigger(form);
  },
  after_save: async () => {
    await ticket_utils.update_related_forms();
  },
  onload: async (form: FrappeForm<Ticket>) => {
    frappe.tooltip.showUserTips({
      form: form,
      doctype: 'Tooltip',
      docnames: ['1', '1']
    });
    ticket_utils.fields_listener(form);
    ticket_utils.runSync(form);
    await ticket_utils.set_service_partner(form);
    await ticket_utils.trigger_create_sn_into_db(form);
    await sub_workflow.pre_actions(form);
    if (form.doc.__islocal) {
      form.set_df_property("main_eqp_serial_no", 'read_only', 0);
    }
  },
  refresh: async (form: FrappeForm<Ticket>) => {
    ticket_utils.runSync(form);
    ticket_utils.fields_listener(form);
    await ticket_utils.set_service_partner(form);
    await ticket_utils.trigger_create_sn_into_db(form);
    await sub_workflow.pre_actions(form);
  },
  before_load: async (form: FrappeForm<Ticket>) => {
    // await ticket_utils.set_service_partner(form);
    ticket_utils.fields_listener(form);
  },
  validate: async (form: FrappeForm<Ticket>) => {
    ticket_utils.fields_listener(form);
    if (!form.doc.__islocal) return;
    const main_eqp_serial_no = form.doc.main_eqp_serial_no;
    if (!main_eqp_serial_no) return;
    const serial_no = await frappe.db
      .get_value<SerialNo>('Serial No', { serial_no: main_eqp_serial_no }, ['serial_no', 'item_code', 'warehouse', 'company', 'status'])
      .catch(e => console.error(e))
      .then(r => r?.message);
    if (serial_no) {
      const initial_analysis = await frappe.db.get_list<InitialAnalysis>('Ticket', {
        filters: { main_eqp_serial_no },
        fields: ['name', 'docstatus'],
      }).catch(e => console.error(e));
      if (initial_analysis && initial_analysis.length > 0) {
        for (let sp of initial_analysis) {
          if (sp.docstatus === 0) {
            frappe.throw(__(` Serial number already has an active ticket: ${sp.name}`));
            return;
          }
        }
      }
    }
  },
});

