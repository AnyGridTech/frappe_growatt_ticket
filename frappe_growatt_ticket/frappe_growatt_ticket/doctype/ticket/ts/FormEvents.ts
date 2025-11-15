/// <reference path="./types/frappe-tooltip.d.ts" />

import { SerialNo, ServiceProtocol, Ticket } from "@anygridtech/frappe-agt-types/agt/doctype";
import type { FrappeForm } from "@anygridtech/frappe-types/client/frappe/core";
import { ticket_utils } from "./Utils";
import { sub_workflow } from "./SubWorkflow";

/*
* This file handles the form events for the Ticket doctype.
* Read more: https://docs.frappe.io/framework/user/en/api/form#form-events
*/

frappe.ui.form.on("Ticket", {
  setup: async (frm: FrappeForm<Ticket>) => {
    if (frm.doc.main_eqp_serial_no) {
      agt.utils.validate_serial_number(frm.doc.main_eqp_serial_no, "inverter");
    }
    await agt.setup.run();
    ticket_utils.fields_listener(frm);
  },
  before_save: async (frm: FrappeForm<Ticket>) => {
    if (!frm.doc?.main_eqp_serial_no) {
      frappe.throw(__(`Número de série requerido.`));
    } else if (!agt.growatt.sn_regex.test(frm.doc?.main_eqp_serial_no)) {
      frappe.throw(__(`Número de série inválido.`));
    }
    await ticket_utils.share_doc_trigger(frm);
  },
  after_save: async () => {
    await ticket_utils.update_related_forms();
  },
  onload: async (frm: FrappeForm<Ticket>) => {
    frappe.tooltip.showUserTips({
      form: frm,
      doctype: 'Tooltip',
      docnames: ['1', '1']
    });
    ticket_utils.fields_listener(frm);
    ticket_utils.runSync(frm);
    await ticket_utils.set_service_partner(frm);
    await ticket_utils.trigger_create_sn_into_db(frm);
    await sub_workflow.pre_actions(frm);
    if (frm.doc.__islocal) {
      frm.set_df_property("main_eqp_serial_no", 'read_only', 0);
    }
  },
  refresh: async (frm: FrappeForm<Ticket>) => {
    ticket_utils.runSync(frm);
    ticket_utils.fields_listener(frm);
    await ticket_utils.set_service_partner(frm);
    await ticket_utils.trigger_create_sn_into_db(frm);
    await sub_workflow.pre_actions(frm);
  },
  before_load: async (frm: FrappeForm<Ticket>) => {
    // await ticket_utils.set_service_partner(frm);
    ticket_utils.fields_listener(frm);
  },
  validate: async (frm: FrappeForm<Ticket>) => {
    ticket_utils.fields_listener(frm);
    if (!frm.doc.__islocal) return;
    const main_eqp_serial_no = frm.doc.main_eqp_serial_no;
    if (!main_eqp_serial_no) return;
    const serial_no = await frappe.db
      .get_value<SerialNo>('Serial No', { serial_no: main_eqp_serial_no }, ['serial_no', 'item_code', 'warehouse', 'company', 'status'])
      .catch(e => console.error(e))
      .then(r => r?.message);
    if (serial_no) {
      const service_protocols = await frappe.db.get_list<ServiceProtocol>('Ticket', {
        filters: { main_eqp_serial_no },
        fields: ['name', 'docstatus'],
      }).catch(e => console.error(e));
      if (service_protocols && service_protocols.length > 0) {
        for (let sp of service_protocols) {
          if (sp.docstatus === 0) {
            frappe.throw(__(`Número de série já possui um ticket ativo: ${sp.name}`));
            return;
          }
        }
      }
    }
  },
});

