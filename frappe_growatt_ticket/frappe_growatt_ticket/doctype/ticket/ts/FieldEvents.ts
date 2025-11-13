import { Ticket, Item, SerialNo } from "@anygridtech/frappe-agt-types/agt/doctype";
import { FrappeForm } from "@anygridtech/frappe-types/client/frappe/core";
import { ticket_utils } from "./Utils";

let prev_main_eqp_serial_no = '';

frappe.ui.form.on("Ticket", {
  add_child_button: async (frm: FrappeForm<Ticket>) => {
    if (!frm.doc.name || frm.doc.__islocal) {
      frappe.msgprint(__("Por favor, salve este documento antes de adicionar um ticket filho."));
      return;
    }
    const allowRoles = frappe.user.has_role(['Standard Employee']);
    if (!allowRoles) {
      frappe.msgprint(__("Você não tem permissão para criar um ticket filho. Contate o administrador do sistema."));
      return;
    }
    const confirmDiag = frappe.confirm(
      "Tem certeza que deseja criar um novo ticket filho?",
      () => {
        frappe.new_doc("Ticket", {
          ticket_docname: frm.doc.name
        });
        console.log("Child created.", frm.doc);
      },
      () => {
        return;
      }
    );
    confirmDiag.set_primary_action("Sim");
    confirmDiag.set_secondary_action_label("Não");
    if (confirmDiag.set_title) confirmDiag.set_title("Confirmação");
  },
  main_eqp_error_version: async (frm: FrappeForm<Ticket>) => {
    const date = frm.doc.ext_fault_date;
    if (!date) return;
    const today = new Date();
    const dateValue = new Date(date);
    if (dateValue > today) frm.set_value('ext_fault_date', undefined);
  },
  ext_fault_date: async (frm: FrappeForm<Ticket>) => {
    const date = frm.doc.ext_fault_date;
    if (!date) return;
    const today = new Date();
    const dateValue = new Date(date);
    if (dateValue > today) frm.set_value('ext_fault_date', undefined);
  },
  main_eqp_serial_no: async (frm: FrappeForm<Ticket>) => {
    ticket_utils.fields_handler(frm);
    const serial_no = frm.doc.main_eqp_serial_no?.trim();
    if (!serial_no?.length) return unsetFields(frm);
    const proceed = agt.growatt.sn_regex.test(serial_no) && serial_no !== prev_main_eqp_serial_no;
    if (!proceed) return unsetFields(frm);
    const sn1 = await frappe.db.get_value<SerialNo>('Serial No', serial_no, ['serial_no', 'item_code', 'warehouse', 'company', 'status'])
      .catch(e => console.error(e))
      .then(r => r?.message);
    if (sn1 && sn1.item_code) {
      console.log(sn1)
      frm.set_value('main_eqp_serial_no', serial_no);
      frm.set_value('main_eqp_model_ref', sn1.item_code);
      prev_main_eqp_serial_no = serial_no;
      return;
    }
    unsetFields(frm);
    const check_mppt_routine = async function (item_name: string) {
      // First try to find an exact match (to not break current functionality)
      let item_info = await frappe.db
        .get_list<Item>(
          'Item',
          {
            filters: { item_name: item_name },
            fields: ['item_code', 'custom_mppt', 'item_name']
          }
        )
        .catch(e => console.error(e));

      // If not found with exact match, do the normalized search as fallback
      if (!item_info || !item_info.length) {
        const all_items = await frappe.db
          .get_list<Item>(
            'Item',
            {
              fields: ['item_code', 'custom_mppt', 'item_name']
            }
          )
          .catch(e => console.error(e));

        if (all_items && all_items.length) {
          const normalizedInput = agt.utils.text.normalize(item_name);
          item_info = all_items.filter(item =>
            agt.utils.text.normalize(item.item_name) === normalizedInput
          );
        }
      }

      console.log(item_info);
      if (!item_info || !item_info.length) return;
      if (item_info.length === 1) {
        frm.set_value('main_eqp_serial_no', serial_no);
        frm.set_value('main_eqp_model_ref', item_info?.[0]?.item_code);
        prev_main_eqp_serial_no = serial_no;
        return;
      }
      const dialog_title = "Selecione a quantidade de MPPTs";
      agt.utils.dialog.load({
        title: dialog_title,
        fields: [
          {
            fieldname: "mppt",
            label: "MPPT",
            fieldtype: "Select",
            options: item_info
              .filter((item) => item.custom_mppt != null)
              .map((item) => item.custom_mppt as string),
            reqd: true
          }
        ],
        primary_action: async function (values) {
          const items = values as FrappeForm<Item>;
          const mppt = items.doc.custom_mppt;
          if (!mppt) return;
          const item = item_info.find((item) => item.custom_mppt === mppt);
          console.log(item)
          agt.utils.dialog.close_by_title(dialog_title);
          if (!item) return;
          frm.set_value('main_eqp_serial_no', serial_no);
          frm.set_value('main_eqp_model_ref', item.item_code);
          prev_main_eqp_serial_no = serial_no;
        },
      })
    }
    const sn2 = await agt.utils.get_growatt_sn_info(serial_no);
    if (!sn2 || !sn2.data || !sn2.data.model) {
      unsetFields(frm);
      const dialog_title = "Selecione o modelo do inversor";
      agt.utils.dialog.load({
        title: dialog_title,
        fields: [
          {
            fieldname: "item_code",
            label: "Modelos Disponiveis",
            fieldtype: "Link",
            options: "Item",
            link_filters: `[["Item","item_group","descendants of (inclusive)","Inverter", "EV Charger", "Battery", "Datalogger", "Smart Meter", "Smart Energy Manager"],["Item","disabled","=",0]]`,
            reqd: true
          },
        ],
        primary_action: async function (values) {
          const items = values as FrappeForm<Item>;
          const model = items.doc.item_code;
          if (!model) return;
          const item_info = await frappe.db
            // .get_value<Item>('Item', { item_code: model }, 'item_name')
            .get_value<Item>('Item', { item_code: model }, ['item_code', 'custom_mppt', 'item_name'])
            .catch(e => console.error(e))
            .then(r => r?.message);
          if (!item_info) return;
          agt.utils.dialog.close_by_title(dialog_title);
          await check_mppt_routine(item_info.item_name);
        }
      });
      return;
    }
    // Check if there is a space before the TL
    // If there isn't, then add it.
    // Sometimes it comes as, for example, MIN 6000TL-X and
    // in our DB the inverter models are registered as MIN 6000 TL-X
    const filtered_name = (() => {
      const model = sn2.data.model;
      // Delete "Growatt " from the beginning of the model
      const no_growatt = (model.includes('Growatt ')) ? model.split('Growatt ')[1] : model;
      // Delete SPF 5000 ES 48VDC 230VAC the part after ES. It must end as SPF 5000 ES and delete the 48VDC 230VAC
      const no_es_model = (no_growatt.includes('ES ')) ? no_growatt.split('ES ')[0] + 'ES' : no_growatt;
      return no_es_model;
    })();
    await check_mppt_routine(filtered_name);
    await ticket_utils.set_service_partner(frm);
  },
  main_eqp_model: async (frm: FrappeForm<Ticket>) => {
    ticket_utils.fields_handler(frm);
  },
});

function unsetFields(form: FrappeForm<Ticket>) {
  form.set_value('main_eqp_model', undefined);
  form.set_value('main_eqp_model_ref', undefined);
  form.set_value('main_eqp_group', undefined);
  form.set_value('main_eqp_type', undefined);
  form.set_value('main_eqp_warehouse', undefined);
  form.set_value('main_eqp_mppt_number', undefined);
  form.set_value('main_eqp_family', undefined);
  form.set_value('main_eqp_error_version', undefined);
  form.set_value('main_eqp_phase', undefined);
  form.set_value('service_partner_company', undefined);
  prev_main_eqp_serial_no = '';
}