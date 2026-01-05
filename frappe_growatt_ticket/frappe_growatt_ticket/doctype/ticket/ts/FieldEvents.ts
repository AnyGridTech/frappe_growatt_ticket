import { Ticket, Item, SerialNo } from "@anygridtech/frappe-agt-types/agt/doctype";
import { FrappeForm } from "@anygridtech/frappe-types/client/frappe/core";
import { ticket_utils } from "./Utils";

let prev_main_eqp_serial_no = '';

// Helpers adapted from frappe_growatt_serial_no_workflow
async function get_item_info_by_model(model: string) {
  if (!model) return [];
  
  // Busca todos os items
  const all_items = await frappe.db.get_list('Item', {
    fields: ['item_code', 'mppt', 'item_name']
  }).catch(() => []);
  
  if (!all_items || !all_items.length) return [];
  
  // Busca flexível usando agt.utils.text.normalize
  const normalizedInput = agt.utils.text.normalize(model);
  const filtered_items = all_items.filter(item => 
    agt.utils.text.normalize(item.item_name) === normalizedInput
  );
  
  return filtered_items || [];
}

async function CheckSerialNumberForTicket(sn: string) {
  if (!sn) return { item: undefined, snInfo: undefined, printError: 'Empty SN.', growattModel: undefined };
  let snInfo;
  try {
    snInfo = await frappe.db.get_value<SerialNo>('Serial No', { serial_no: sn }, ['workflow_state', 'item_code', 'item_name', 'company'])
      .then(r => r?.message || null)
      .catch(() => null);
  } catch (e) {
    return { item: undefined, snInfo: undefined, printError: 'Error fetching SN info.', growattModel: undefined };
  }
  if (!snInfo || Object.keys(snInfo).length === 0) {
    let sn2;
    try {
      sn2 = await agt?.utils?.get_growatt_sn_info?.(sn);
    } catch (e) {
      return { item: undefined, snInfo: undefined, printError: 'Error fetching SN from Growatt.', growattModel: undefined };
    }
    if (!sn2 || !sn2.data || !sn2.data.model) return { item: undefined, snInfo: undefined, printError: '', growattModel: undefined };
    let item;
    try {
      item = await get_item_info_by_model(sn2.data.model);
    } catch (e) {
      return { item: undefined, snInfo: undefined, printError: 'Error fetching item info.', growattModel: sn2.data.model };
    }
    return { item, snInfo: undefined, printError: '', growattModel: sn2.data.model };
  }
  return { item: {}, snInfo, printError: '', growattModel: undefined };
}

frappe.ui.form.on("Ticket", {
  add_child_button: async (form: FrappeForm<Ticket>) => {
    if (!form.doc.name || form.doc.__islocal) {
      frappe.msgprint(__("Please save this document before adding a child ticket."));
      return;
    }
    const allowRoles = frappe.user.has_role(['Standard Employee']);
    if (!allowRoles) {
      frappe.msgprint(__("You do not have permission to create a child ticket. Please contact the system administrator."));
      return;
    }
    const confirmDiag = frappe.confirm(
      __("Are you sure you want to create a new child ticket?"),
      () => {
        frappe.new_doc("Ticket", {
          ticket_docname: form.doc.name
        });
        console.log("Child created.", form.doc);
      },
      () => {
        return;
      }
    );
    confirmDiag.set_primary_action(__("Yes"));
    confirmDiag.set_secondary_action_label(__("No"));
    if (confirmDiag.set_title) confirmDiag.set_title(__("Confirmation"));
  },
  main_eqp_error_version: async (form: FrappeForm<Ticket>) => {
    const date = form.doc.ext_fault_date;
    if (!date) return;
    const today = new Date();
    const dateValue = new Date(date);
    if (dateValue > today) form.set_value('ext_fault_date', undefined);
  },
  ext_fault_date: async (form: FrappeForm<Ticket>) => {
    const date = form.doc.ext_fault_date;
    if (!date) return;
    const today = new Date();
    const dateValue = new Date(date);
    if (dateValue > today) form.set_value('ext_fault_date', undefined);
  },
  main_eqp_serial_no: async (form: FrappeForm<Ticket>) => {
    ticket_utils.fields_handler(form);
    const serial_no = form.doc.main_eqp_serial_no?.trim();
    if (!serial_no?.length) return unsetFields(form);
    const proceed = agt.utils.validate_serial_number(serial_no) && serial_no !== prev_main_eqp_serial_no;
    if (!proceed) return unsetFields(form);

    // Use unified checker
    const { item, snInfo, growattModel } = await CheckSerialNumberForTicket(serial_no);

    // If found in ERP (serial exists)
    if (snInfo && snInfo.item_code) {
      form.set_value('main_eqp_serial_no', serial_no);
      form.set_value('main_eqp_model_ref', snInfo.item_code);
      form.set_value('main_eqp_model', snInfo.item_name || undefined);
      prev_main_eqp_serial_no = serial_no;
      await ticket_utils.set_service_partner(form);
      return;
    }

    // If Growatt returned model and we have item candidates
    if (item && Array.isArray(item) && item.length) {
      // Gather MPPT options and companies
      const itemList = item;
      const itemsWithMPPT = itemList.filter((i: any) => i.mppt != null);
      const hasMPPT = itemsWithMPPT.length > 1;
      const mpptOptions = hasMPPT ? itemsWithMPPT.map((i: any) => i.mppt as string) : [];

      let companies: any[] = [];
      try {
        companies = await frappe.db.get_list('Company', { fields: ['name'], filters: { name: ['in', ['Anygrid', 'Growatt']] } });
      } catch (e) { console.warn('Error fetching companies', e); }
      const companyOptions = companies && companies.length ? companies.map(c => c.name) : [];

      const dialogTitle = __('Complete information for SN: ') + serial_no;
      const dialogFields: any[] = [
        {
          fieldname: 'sn_display', label: __('Serial Number'), fieldtype: 'Data', default: serial_no, read_only: true
        },
        {
          fieldname: 'model_display', label: __('Model'), fieldtype: 'Data', default: growattModel || '', read_only: true
        }
      ];
      if (hasMPPT) {
        dialogFields.push({ fieldname: 'mppt', label: 'MPPT', fieldtype: 'Select', options: mpptOptions, reqd: true });
      }
      if (companyOptions.length > 0) {
        dialogFields.push({ fieldname: 'company', label: 'Company', fieldtype: 'Select', options: companyOptions, reqd: true });
      }

      const selectionPromise = new Promise<{ mppt?: string; company?: string } | null>((resolve) => {
        let isResolved = false;
        const dialog = agt.utils.dialog.load({
          title: dialogTitle,
          fields: dialogFields,
          primary_action: function (values: any) {
            isResolved = true;
            agt.utils.dialog.close_by_title(dialogTitle);
            resolve(values);
          }
        });
        if (dialog && dialog['$wrapper']) {
          dialog['$wrapper'].on('hide.bs.modal', function() {
            if (!isResolved) { isResolved = true; resolve(null); }
          });
        }
      });

      const selectedValues = await selectionPromise;
      if (!selectedValues) {
        // cancelled
        return;
      }

      // Determine selected item
      let selectedItem: any = null;
      if (hasMPPT && selectedValues.mppt) {
        selectedItem = itemsWithMPPT.find((i: any) => String(i.mppt).trim() === String(selectedValues.mppt).trim());
      } else if (itemList.length === 1) {
        selectedItem = itemList[0];
      } else if (!hasMPPT && itemList.length > 0) {
        selectedItem = itemList[0];
      }

      if (!selectedItem) return;

      form.set_value('main_eqp_serial_no', serial_no);
      form.set_value('main_eqp_model_ref', selectedItem.item_code);
      form.set_value('main_eqp_model', selectedItem.item_name);
      form.set_value('main_eqp_mppt_number', selectedItem.mppt || undefined);
      if (selectedValues.company) form.set_value('service_partner_company', selectedValues.company);
      prev_main_eqp_serial_no = serial_no;
      await ticket_utils.set_service_partner(form);
      return;
    }

    // Fallback: ask user to pick Item with consistent interface
    unsetFields(form);
    const dialog_title = "Select the equipment model";
    agt.utils.dialog.load({
      title: dialog_title,
      fields: [
        {
          fieldname: "item_code",
          label: "Select Model",
          fieldtype: "Link",
          options: "Item",
          get_query: function () {
            return {
              filters: [
                ['Item', 'item_group', 'in', ['Inverter', 'EV Charger', 'Battery', 'Datalogger', 'Smart Meter', 'Smart Energy Manager']],
                ['Item', 'disabled', '=', 0]
              ]
            };
          },
          reqd: true
        },
      ],
      primary_action_label: "Select",
      primary_action: async function (values) {
        const model = values['item_code'];
        if (!model) return;
        const item_info = await frappe.db.get_value<Item>('Item', { item_code: model }, ['item_code', 'mppt', 'item_name']).catch(e => console.error(e)).then(r => r?.message);
        if (!item_info) return;
        agt.utils.dialog.close_by_title(dialog_title);
        
        // Get other items with same model to check MPPT options (consistent with Growatt flow)
        const itemList = [item_info];
        const allItemsWithModel = await frappe.db.get_list('Item', {
          filters: { item_name: item_info.item_name },
          fields: ['item_code', 'mppt', 'item_name']
        }).catch(() => []);
        
        const itemsToCheck = allItemsWithModel.length > 1 ? allItemsWithModel : itemList;
        const itemsWithMPPT = itemsToCheck.filter((i: any) => i.mppt != null);
        const hasMPPT = itemsWithMPPT.length > 1;
        const mpptOptions = hasMPPT ? itemsWithMPPT.map((i: any) => i.mppt as string) : [];

        let companies: any[] = [];
        try {
          companies = await frappe.db.get_list('Company', { fields: ['name'], filters: { name: ['in', ['Anygrid', 'Growatt']] } });
        } catch (e) { console.warn('Error fetching companies', e); }
        const companyOptions = companies && companies.length ? companies.map(c => c.name) : [];

        // If no MPPT selection needed and no companies, apply directly
        if (!hasMPPT && companyOptions.length === 0) {
          form.set_value('main_eqp_serial_no', serial_no);
          form.set_value('main_eqp_model_ref', item_info.item_code);
          form.set_value('main_eqp_model', item_info.item_name);
          form.set_value('main_eqp_mppt_number', item_info.mppt || undefined);
          prev_main_eqp_serial_no = serial_no;
          await ticket_utils.set_service_partner(form);
          return;
        }

        // Show consistent dialog for MPPT/Company selection
        const detailsDialogTitle = __('Complete information for SN: ') + serial_no;
        const detailsFields: any[] = [
          {
            fieldname: 'sn_display', label: __('Serial Number'), fieldtype: 'Data', default: serial_no, read_only: true
          },
          {
            fieldname: 'model_display', label: __('Model'), fieldtype: 'Data', default: item_info.item_name || '', read_only: true
          }
        ];
        if (hasMPPT) {
          detailsFields.push({ fieldname: 'mppt', label: 'MPPT', fieldtype: 'Select', options: mpptOptions, reqd: true });
        }
        if (companyOptions.length > 0) {
          detailsFields.push({ fieldname: 'company', label: 'Company', fieldtype: 'Select', options: companyOptions, reqd: true });
        }

        const detailsPromise = new Promise<{ mppt?: string; company?: string } | null>((resolve) => {
          let isResolved = false;
          const dialog = agt.utils.dialog.load({
            title: detailsDialogTitle,
            fields: detailsFields,
            primary_action: function (values: any) {
              isResolved = true;
              agt.utils.dialog.close_by_title(detailsDialogTitle);
              resolve(values);
            }
          });
          if (dialog && dialog['$wrapper']) {
            dialog['$wrapper'].on('hide.bs.modal', function() {
              if (!isResolved) { isResolved = true; resolve(null); }
            });
          }
        });

        const selectedDetails = await detailsPromise;
        if (!selectedDetails) return;

        // Determine final item based on MPPT selection
        let finalItem: any = item_info;
        if (hasMPPT && selectedDetails.mppt) {
          finalItem = itemsWithMPPT.find((i: any) => String(i.mppt).trim() === String(selectedDetails.mppt).trim()) || item_info;
        }

        form.set_value('main_eqp_serial_no', serial_no);
        form.set_value('main_eqp_model_ref', finalItem.item_code);
        form.set_value('main_eqp_model', finalItem.item_name);
        form.set_value('main_eqp_mppt_number', finalItem.mppt || undefined);
        if (selectedDetails.company) form.set_value('service_partner_company', selectedDetails.company);
        prev_main_eqp_serial_no = serial_no;
        await ticket_utils.set_service_partner(form);
      }
    });
  },
  main_eqp_model: async (form: FrappeForm<Ticket>) => {
    ticket_utils.fields_handler(form);
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