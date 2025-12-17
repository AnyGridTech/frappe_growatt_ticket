import { FrappeForm } from "@anygridtech/frappe-types/client/frappe/core";
import { Ticket, Item, SerialNo, Company } from "@anygridtech/frappe-agt-types/agt/doctype";

const ticket_utils = {
  async update_related_forms(): Promise<void> {
    const fields_record = cur_frm.fields_dict;
    const wci = agt.utils.table.row.find(cur_frm, 'checklist_table_inverter', { or: { docstatus: [0] } });
    const wcc = agt.utils.table.row.find(cur_frm, 'checklist_table_ev_charger', { or: { docstatus: [0] } });
    const wcb = agt.utils.table.row.find(cur_frm, 'checklist_table_battery', { or: { docstatus: [0] } });
    const wcs = agt.utils.table.row.find(cur_frm, 'checklist_table_smart_meter', { or: { docstatus: [0] } });
    const wcem = agt.utils.table.row.find(cur_frm, 'checklist_table_smart_energy_manager', { or: { docstatus: [0] } });
    const wcd = agt.utils.table.row.find(cur_frm, 'checklist_table_datalogger', { or: { docstatus: [0] } });
    const wsp = agt.utils.table.row.find(cur_frm, 'checklist_table_initial_analysis', { or: { docstatus: [0] } });

    const clean_dict = Object.entries(fields_record)
      .filter(([_, v]) => v.value !== undefined)
      .reduce((acc, [k, v]) => {
        acc[k] = v.value;
        return acc;
      }, {} as Record<string, any>);

    const shared_users = frappe.model.get_shared('Ticket', cur_frm.docname);
    wci?.forEach(async row => {
      await agt.utils.doc.update_doc('Service Protocol Inverter Checklist', row.checklist_docname, clean_dict);
      await agt.utils.doc.share_doc('Service Protocol Inverter Checklist', row.checklist_docname, shared_users);
    });
    wcc?.forEach(async row => {
      await agt.utils.doc.update_doc('Service Protocol EV Charger Checklist', row.checklist_docname, clean_dict);
      await agt.utils.doc.share_doc('Service Protocol EV Charger Checklist', row.checklist_docname, shared_users);
    });
    wcb?.forEach(async row => {
      await agt.utils.doc.update_doc('Service Protocol Battery Checklist', row.checklist_docname, clean_dict);
      await agt.utils.doc.share_doc('Service Protocol Battery Checklist', row.checklist_docname, shared_users);
    });
    wcs?.forEach(async row => {
      await agt.utils.doc.update_doc('Service Protocol Smart Meter Checklist', row.checklist_docname, clean_dict);
      await agt.utils.doc.share_doc('Service Protocol Smart Meter Checklist', row.checklist_docname, shared_users);
    });
    wcem?.forEach(async row => {
      await agt.utils.doc.update_doc('Service Protocol Smart Energy Manager Checklist', row.checklist_docname, clean_dict);
      await agt.utils.doc.share_doc('Service Protocol Smart Energy Manager Checklist', row.checklist_docname, shared_users);
    });
    wcd?.forEach(async row => {
      await agt.utils.doc.update_doc('Service Protocol Datalogger Checklist', row.checklist_docname, clean_dict);
      await agt.utils.doc.share_doc('Service Protocol Datalogger Checklist', row.checklist_docname, shared_users);
    });
    wsp?.forEach(async row => {
      await agt.utils.doc.update_doc('Initial Analysis', row.checklist_docname, clean_dict);
      await agt.utils.doc.share_doc('Initial Analysis', row.checklist_docname, shared_users);
    });
  },
  fields_listener(frm: FrappeForm<Ticket>) {
    ticket_utils.fields_handler(frm);
    Object.keys(frm.fields_dict).forEach((fn) => {
      const field = frm.fields_dict[fn];
      if (field && field.df) {
        field.df['onchange'] = () => {
          ticket_utils.fields_handler(frm);
        };
      }
    });
  },
  fields_handler: function fields_handler(frm: FrappeForm<Ticket>) {

    agt.utils.form.set_button_primary_style(frm, 'add_child_button');

    // setup const to grab workflow state by number
    const workflowStates = agt.metadata.doctype.ticket.workflow_state;
    const currentStateId = Object.values(workflowStates).find(state => state.name === frm.doc.workflow_state)?.id || 0;
    // add_child_button, child_table, checklist_table_html, section_eqp_failure
    const sectionStarting = [
      'add_child_button',
      'child_tracker_html',
    ];
    sectionStarting.forEach(f => {
      frm.set_df_property(f, 'hidden', (frm.doc.__islocal || currentStateId <= 0) ? 1 : 0);
      frm.set_df_property(f, 'read_only', currentStateId >= 10 ? 1 : 0);
    });
    // colbreak_additional_info
    agt.utils.form.field.set_properties(
      frm,
      Object.fromEntries(['colbreak_eqp_3'].map(f => [f, { hidden: frm.doc.main_eqp_model ? 0 : 1 }]))
    );

    agt.utils.form.field.set_properties(
      frm,
      Object.fromEntries(['colbreak_eqp_3'].map(f => [f, { read_only: currentStateId >= 2 ? 1 : 0 }]))
    );
  },
  trigger_create_sn_into_db: async (frm: FrappeForm<Ticket>) => {
    if (frm.doc.__islocal) return;
    const serial_no = frm.doc.main_eqp_serial_no!;
    if (!serial_no) {
      console.error("Serial number not provided");
      return;
    }

    const db_sn = await frappe.db
      .get_value<SerialNo>('Serial No', serial_no, ['serial_no', 'item_code', 'warehouse', 'company', 'status', 'workflow_state'])
      .catch(e => {
        console.error("Error fetching serial number:", e);
        return null;
      })
      .then(r => r?.message);

    const hasKeys = (obj: any) => obj && typeof obj === "object" && Object.keys(obj).length > 0;
    // const isEmptyObj = (obj: any) => obj && typeof obj === "object" && Object.keys(obj).length === 0;
    const service_partner_company = frm.doc.service_partner_company;
    if (!service_partner_company) {
      console.error("Service partner company not defined");
      return;
    }

    // If db_sn is not defined or is empty, we will create a new record

    if (db_sn && hasKeys(db_sn)) {
      // Serial Number found and has properties - update workflow state
      try {
        await agt.utils.update_workflow_state({
          doctype: "Serial No",
          docname: db_sn.serial_no,
          workflow_state: agt.metadata.doctype.ticket.workflow_state.active.name,
          ignore_workflow_validation: true
        });
        console.log("Estado de workflow do Serial No atualizado com sucesso:", db_sn.serial_no);
      } catch (error) {
        console.error("Error updating Serial No workflow state:", error);
        throw new Error("Error updating workflow state: " + (error instanceof Error ? error.message : String(error)));
      }
    } else {
      // Serial Number not found or empty - create new
      const item = await frappe.db
        .get_value<Item>('Item', { item_code: frm.doc.main_eqp_item_code! }, ['item_name', 'item_code'])
        .catch(e => {
          console.error("Erro ao buscar item:", e);
          return null;
        })
        .then(r => r?.message);

      if (!item) {
        console.error("Item not found for code:", frm.doc.main_eqp_item_code);
        throw new Error(`Item not found for code: ${frm.doc.main_eqp_item_code}`);
      }
      try {
        console.log("Creating new Serial No:", serial_no);
        // Create object with fields to create a Serial No
        // We need to create an object that emulates the structure of form.fields_dict
        const serialNoFields: Record<string, any> = {};

        // Set each field with the expected structure {value: fieldValue}
        serialNoFields['serial_no'] = { value: serial_no };
        serialNoFields['item_code'] = { value: item.item_code };
        serialNoFields['company'] = { value: service_partner_company };
        serialNoFields['status'] = { value: "Active" };

        console.log("Fields for Serial No creation:", JSON.stringify(serialNoFields));

        const sn_docname = await agt.utils.doc.create_doc<SerialNo>('Serial No', {}, serialNoFields);

        if (!sn_docname) {
          throw new Error("Failed to create Serial No - no document name returned");
        }

        console.log("Serial No created successfully:", sn_docname);

        // Update the workflow state for the newly created Serial No
        await agt.utils.update_workflow_state({
          doctype: "Serial No",
          docname: sn_docname,
          workflow_state: agt.metadata.doctype.ticket.workflow_state.active.name,
          ignore_workflow_validation: true
        });
        console.log("Serial No workflow state updated successfully:", sn_docname);
      } catch (error) {
        console.error("Error creating or updating Serial No:", error);
        throw new Error("Error creating or updating Serial No: " + (error instanceof Error ? error.message : String(error)));
      }
    }
  },
  set_service_partner: async function (frm: FrappeForm<Ticket>) {
    async function decideServicePartner() {
      const service_partner_companies = await ticket_utils.GetServPartnerCompanies();
      return service_partner_companies?.filter((c: Company) => c.name === "Growatt")[0];
    }
    // if (frm.doc.workflow_state === growatt.namespace.ticket.workflow_state.active.name) return;
    if (frm.doc.__islocal) return;
    const service_partner_company = frm.doc.service_partner_company;
    if (service_partner_company) return;
    const spc = await decideServicePartner();
    if (!spc) return;
    await agt.utils.doc.update_doc(frm.doctype, frm.docname, { service_partner_company: spc.name });
  },
  GetServPartnerCompanies: async function (name?: string) {
    return await frappe.db.get_list<Company>('Company', {
      filters: {
        service_partner: 1,
        name
      },
      fields: ['name', 'abbr', 'is_group']
    });
  },
  share_doc_trigger: async function (frm: FrappeForm<Ticket>) {
    if (frm.doc.__islocal) return;
    const mainCustomer = frm.doc.main_customer_email;
    if (mainCustomer) {
      const shared_users = [
        {
          creation: '',
          everyone: 0,
          name: '',
          owner: '',
          read: 1,
          share: 1,
          submit: 1,
          user: mainCustomer,
          write: 1
        }
      ];
      await agt.utils.doc.share_doc('Ticket', frm.doc.name, shared_users);
    }
  },
  runSync: async function (frm: FrappeForm<Ticket>) {
    if (frm.doc.__islocal) return;

    const doctypes = [
      'Ticket',
      'Initial Analysis',
      'Service Protocol Inverter Checklist',
      'Service Protocol EV Charger Checklist',
      'Service Protocol Battery Checklist',
      'Service Protocol Smart Meter Checklist',
      'Service Protocol Smart Energy Manager Checklist',
      'Service Protocol Datalogger Checklist',
      'Proposed Dispatch',
      'Compliance Statement',
    ];

    // Espelhar todos os documentos relacionados pelo ticket_docname
    
    await agt.corrections_tracker.table.mirror_child_tracker_table(frm, doctypes, 'ticket_docname');

    const childTrackerField = frm.fields_dict['child_tracker_html'];
    if (!childTrackerField?.$wrapper) return;

    agt.utils.form.render_doc_fields_table(
      childTrackerField.$wrapper,
      frm.doc['child_tracker_table'],
      [
        {
          fieldname: 'child_tracker_docname',
          label: 'Visualizar Documento',
          formatter: (value, doc) => {
            if (!value || !doc['child_tracker_doctype']) return String(value || '');
            return `<a href="#" class="child-tracker-open" data-doctype="${String(doc['child_tracker_doctype']).replace(/\"/g, '&quot;')}" data-docname="${String(value).replace(/\"/g, '&quot;')}">${String(value)} <i class="fa fa-external-link" style="font-size: 1.25em; color: var(--text-muted)"></i></a>`;
          }
        },
        {
          fieldname: 'child_tracker_doctype',
          label: 'Tipo de Documento',
          formatter: (value) => {
            if (!value) return String(value || '');
            const slug = String(value).toLowerCase().replace(/\s+/g, '-');
            return `<a href="/app/${slug}" target="_blank">${String(value)}</a>`;
          }
        },
        {
          fieldname: 'child_tracker_workflow_state',
          label: 'Status do Documento',
          formatter: (value, doc) => {
            if (!value) return String(value || '');

            const state = String(value);

            // Mapeamento de cores baseado nos estados mais comuns do workflow
            const stateColorMap: Record<string, string> = {
              'Draft': 'orange',
              'Rascunho': 'orange',
              'Submitted': 'blue',
              'Submetido': 'blue',
              'Approved': 'green',
              'Aprovado': 'green',
              'Rejected': 'red',
              'Rejeitado': 'red',
              'Cancelled': 'grey',
              'Cancelado': 'grey',
              'Finished': 'green',
              'Concluído': 'green',
              'Finalizado': 'green',
              'Análise Preliminar': 'purple',
              'Cliente: Corrigir Informações': 'orange',
              'Cliente: Finalizar Preenchimento': 'orange',
              'Revisão': 'yellow',
              'Checklist': 'blue',
              'Proposta de Envio': 'purple',
              'Declaração de Conformidade': 'darkblue',
              'Garantia Aprovada': 'green',
              'Cliente: Ação Necessária': 'orange'
            };

            // Tenta primeiro usar os metadados do workflow do Frappe
            const doctype = doc['child_tracker_doctype'];
            if (doctype && (window as any).frappe?.boot?.workflows) {
              try {
                const workflows = (window as any).frappe.boot.workflows as Record<string, any>;
                const workflow = workflows[String(doctype)];

                if (workflow && workflow.states) {
                  const stateInfo = workflow.states.find((s: any) => s.state === state);
                  if (stateInfo && stateInfo.style) {
                    const colorClass = stateInfo.style.toLowerCase();
                    return `<span class="indicator-pill ${colorClass}">${state}</span>`;
                  }
                }
              } catch (e) {
                console.warn('Error accessing workflow metadata:', e);
              }
            }

            // Fallback: usa o mapeamento manual de cores
            const color = stateColorMap[state] || 'blue';
            return `<span class="indicator-pill ${color}">${state}</span>`;
          }
        }
      ]
    );

    // attach click handler to open modal
    try {
      const childTrackerHtml = frm.fields_dict['child_tracker_html'];
      if (childTrackerHtml && childTrackerHtml.$wrapper) {
        const wrapper = childTrackerHtml.$wrapper.get(0);
        (wrapper as any)?.removeEventListener?.('__growatt_child_click' as any, () => { });
      }
    } catch (e) { /* ignore */ }

    const $wrapper = (frm.fields_dict as any).child_tracker_html.$wrapper;
    if ($wrapper) {
      ($($wrapper) as any)
        .off('click', '.child-tracker-open')
        .on('click', '.child-tracker-open', function (this: HTMLElement, ev: any) {
          ev.preventDefault();
          const $el = $(this);
          const doctype = $el.attr('data-doctype');
          const docname = $el.attr('data-docname');
          if (!doctype || !docname) return;
          (frappe as any).iframe.view._open_doc_modal(doctype, docname);
        });
    }
  },
};                       
export { ticket_utils };

