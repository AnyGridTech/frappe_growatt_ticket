// Copyright (c) 2025, AnyGridTech and contributors
// For license information, please see license.txt
"use strict";
(() => {
  // frappe_growatt_ticket/doctype/ticket/ts/Utils.ts
  var ticket_utils = {
    async update_related_forms() {
      const fields_record = cur_frm.fields_dict;
      const wci = agt.utils.table.row.find(cur_frm, "checklist_table_inverter", { or: { docstatus: [0] } });
      const wcc = agt.utils.table.row.find(cur_frm, "checklist_table_ev_charger", { or: { docstatus: [0] } });
      const wcb = agt.utils.table.row.find(cur_frm, "checklist_table_battery", { or: { docstatus: [0] } });
      const wcs = agt.utils.table.row.find(cur_frm, "checklist_table_smart_meter", { or: { docstatus: [0] } });
      const wcem = agt.utils.table.row.find(cur_frm, "checklist_table_smart_energy_manager", { or: { docstatus: [0] } });
      const wcd = agt.utils.table.row.find(cur_frm, "checklist_table_datalogger", { or: { docstatus: [0] } });
      const wsp = agt.utils.table.row.find(cur_frm, "checklist_table_initial_analysis", { or: { docstatus: [0] } });
      const clean_dict = Object.entries(fields_record).filter(([_, v]) => v.value !== void 0).reduce((acc, [k, v]) => {
        acc[k] = v.value;
        return acc;
      }, {});
      const shared_users = frappe.model.get_shared("Ticket", cur_frm.docname);
      wci?.forEach(async (row) => {
        await agt.utils.doc.update_doc("Service Protocol Inverter Checklist", row.checklist_docname, clean_dict);
        await agt.utils.doc.share_doc("Service Protocol Inverter Checklist", row.checklist_docname, shared_users);
      });
      wcc?.forEach(async (row) => {
        await agt.utils.doc.update_doc("Service Protocol EV Charger Checklist", row.checklist_docname, clean_dict);
        await agt.utils.doc.share_doc("Service Protocol EV Charger Checklist", row.checklist_docname, shared_users);
      });
      wcb?.forEach(async (row) => {
        await agt.utils.doc.update_doc("Service Protocol Battery Checklist", row.checklist_docname, clean_dict);
        await agt.utils.doc.share_doc("Service Protocol Battery Checklist", row.checklist_docname, shared_users);
      });
      wcs?.forEach(async (row) => {
        await agt.utils.doc.update_doc("Service Protocol Smart Meter Checklist", row.checklist_docname, clean_dict);
        await agt.utils.doc.share_doc("Service Protocol Smart Meter Checklist", row.checklist_docname, shared_users);
      });
      wcem?.forEach(async (row) => {
        await agt.utils.doc.update_doc("Service Protocol Smart Energy Manager Checklist", row.checklist_docname, clean_dict);
        await agt.utils.doc.share_doc("Service Protocol Smart Energy Manager Checklist", row.checklist_docname, shared_users);
      });
      wcd?.forEach(async (row) => {
        await agt.utils.doc.update_doc("Service Protocol Datalogger Checklist", row.checklist_docname, clean_dict);
        await agt.utils.doc.share_doc("Service Protocol Datalogger Checklist", row.checklist_docname, shared_users);
      });
      wsp?.forEach(async (row) => {
        await agt.utils.doc.update_doc("Initial Analysis", row.checklist_docname, clean_dict);
        await agt.utils.doc.share_doc("Initial Analysis", row.checklist_docname, shared_users);
      });
    },
    fields_listener(frm) {
      ticket_utils.fields_handler(frm);
      Object.keys(frm.fields_dict).forEach((fn) => {
        const field = frm.fields_dict[fn];
        if (field && field.df) {
          field.df["onchange"] = () => {
            ticket_utils.fields_handler(frm);
          };
        }
      });
    },
    fields_handler: function fields_handler(frm) {
      agt.utils.form.set_button_primary_style(frm, "add_child_button");
      const workflowStates = agt.metadata.doctype.ticket.workflow_state;
      const currentStateId = Object.values(workflowStates).find((state) => state.name === frm.doc.workflow_state)?.id || 0;
      const sectionStarting = [
        "add_child_button",
        "child_tracker_html"
      ];
      sectionStarting.forEach((f) => {
        frm.set_df_property(f, "hidden", frm.doc.__islocal || currentStateId <= 0 ? 1 : 0);
        frm.set_df_property(f, "read_only", currentStateId >= 10 ? 1 : 0);
      });
      agt.utils.form.field.set_properties(
        frm,
        Object.fromEntries(["colbreak_eqp_3"].map((f) => [f, { hidden: frm.doc.main_eqp_model ? 0 : 1 }]))
      );
      agt.utils.form.field.set_properties(
        frm,
        Object.fromEntries(["colbreak_eqp_3"].map((f) => [f, { read_only: currentStateId >= 2 ? 1 : 0 }]))
      );
    },
    trigger_create_sn_into_db: async (frm) => {
      if (frm.doc.__islocal) return;
      const serial_no = frm.doc.main_eqp_serial_no;
      if (!serial_no) {
        console.error("Serial number not provided");
        return;
      }
      const db_sn = await frappe.db.get_value("Serial No", serial_no, ["serial_no", "item_code", "warehouse", "company", "status", "workflow_state"]).catch((e) => {
        console.error("Error fetching serial number:", e);
        return null;
      }).then((r) => r?.message);
      const hasKeys = (obj) => obj && typeof obj === "object" && Object.keys(obj).length > 0;
      const service_partner_company = frm.doc.service_partner_company;
      if (!service_partner_company) {
        console.error("Service partner company not defined");
        return;
      }
      if (db_sn && hasKeys(db_sn)) {
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
        const item = await frappe.db.get_value("Item", { item_code: frm.doc.main_eqp_item_code }, ["item_name", "item_code"]).catch((e) => {
          console.error("Erro ao buscar item:", e);
          return null;
        }).then((r) => r?.message);
        if (!item) {
          console.error("Item not found for code:", frm.doc.main_eqp_item_code);
          throw new Error(`Item not found for code: ${frm.doc.main_eqp_item_code}`);
        }
        try {
          console.log("Creating new Serial No:", serial_no);
          const serialNoFields = {};
          serialNoFields["serial_no"] = { value: serial_no };
          serialNoFields["item_code"] = { value: item.item_code };
          serialNoFields["company"] = { value: service_partner_company };
          serialNoFields["status"] = { value: "Active" };
          console.log("Fields for Serial No creation:", JSON.stringify(serialNoFields));
          const sn_docname = await agt.utils.doc.create_doc("Serial No", {}, serialNoFields);
          if (!sn_docname) {
            throw new Error("Failed to create Serial No - no document name returned");
          }
          console.log("Serial No created successfully:", sn_docname);
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
    set_service_partner: async function(frm) {
      async function decideServicePartner() {
        const service_partner_companies = await ticket_utils.GetServPartnerCompanies();
        return service_partner_companies?.filter((c) => c.name === "Growatt")[0];
      }
      if (frm.doc.__islocal) return;
      const service_partner_company = frm.doc.service_partner_company;
      if (service_partner_company) return;
      const spc = await decideServicePartner();
      if (!spc) return;
      await agt.utils.doc.update_doc(frm.doctype, frm.docname, { service_partner_company: spc.name });
    },
    GetServPartnerCompanies: async function(name) {
      return await frappe.db.get_list("Company", {
        filters: {
          service_partner: 1,
          name
        },
        fields: ["name", "abbr", "is_group"]
      });
    },
    share_doc_trigger: async function(frm) {
      if (frm.doc.__islocal) return;
      const mainCustomer = frm.doc.main_customer_email;
      if (mainCustomer) {
        const shared_users = [
          {
            creation: "",
            everyone: 0,
            name: "",
            owner: "",
            read: 1,
            share: 1,
            submit: 1,
            user: mainCustomer,
            write: 1
          }
        ];
        await agt.utils.doc.share_doc("Ticket", frm.doc.name, shared_users);
      }
    },
    runSync: async function(frm) {
      if (frm.doc.__islocal) return;
      const doctypes = [
        "Ticket",
        "Initial Analysis",
        "Service Protocol Inverter Checklist",
        "Service Protocol EV Charger Checklist",
        "Service Protocol Battery Checklist",
        "Service Protocol Smart Meter Checklist",
        "Service Protocol Smart Energy Manager Checklist",
        "Service Protocol Datalogger Checklist",
        "Proposed Dispatch",
        "Compliance Statement"
      ];
      await agt.corrections_tracker.table.mirror_child_tracker_table(frm, doctypes, "ticket_docname");
      const childTrackerField = frm.fields_dict["child_tracker_html"];
      if (!childTrackerField?.$wrapper) return;
      agt.utils.form.render_doc_fields_table(
        childTrackerField.$wrapper,
        frm.doc["child_tracker_table"],
        [
          {
            fieldname: "child_tracker_docname",
            label: "Visualizar Documento",
            formatter: (value, doc) => {
              if (!value || !doc["child_tracker_doctype"]) return String(value || "");
              return `<a href="#" class="child-tracker-open" data-doctype="${String(doc["child_tracker_doctype"]).replace(/\"/g, "&quot;")}" data-docname="${String(value).replace(/\"/g, "&quot;")}">${String(value)} <i class="fa fa-external-link" style="font-size: 1.25em; color: var(--text-muted)"></i></a>`;
            }
          },
          {
            fieldname: "child_tracker_doctype",
            label: "Tipo de Documento",
            formatter: (value) => {
              if (!value) return String(value || "");
              const slug = String(value).toLowerCase().replace(/\s+/g, "-");
              return `<a href="/app/${slug}" target="_blank">${String(value)}</a>`;
            }
          },
          {
            fieldname: "child_tracker_workflow_state",
            label: "Status do Documento",
            formatter: (value, doc) => {
              if (!value) return String(value || "");
              const state = String(value);
              const stateColorMap = {
                "Draft": "orange",
                "Rascunho": "orange",
                "Submitted": "blue",
                "Submetido": "blue",
                "Approved": "green",
                "Aprovado": "green",
                "Rejected": "red",
                "Rejeitado": "red",
                "Cancelled": "grey",
                "Cancelado": "grey",
                "Finished": "green",
                "Conclu\xEDdo": "green",
                "Finalizado": "green",
                "An\xE1lise Preliminar": "purple",
                "Cliente: Corrigir Informa\xE7\xF5es": "orange",
                "Cliente: Finalizar Preenchimento": "orange",
                "Revis\xE3o": "yellow",
                "Checklist": "blue",
                "Proposta de Envio": "purple",
                "Declara\xE7\xE3o de Conformidade": "darkblue",
                "Garantia Aprovada": "green",
                "Cliente: A\xE7\xE3o Necess\xE1ria": "orange"
              };
              const doctype = doc["child_tracker_doctype"];
              if (doctype && window.frappe?.boot?.workflows) {
                try {
                  const workflows = window.frappe.boot.workflows;
                  const workflow = workflows[String(doctype)];
                  if (workflow && workflow.states) {
                    const stateInfo = workflow.states.find((s) => s.state === state);
                    if (stateInfo && stateInfo.style) {
                      const colorClass = stateInfo.style.toLowerCase();
                      return `<span class="indicator-pill ${colorClass}">${state}</span>`;
                    }
                  }
                } catch (e) {
                  console.warn("Error accessing workflow metadata:", e);
                }
              }
              const color = stateColorMap[state] || "blue";
              return `<span class="indicator-pill ${color}">${state}</span>`;
            }
          }
        ]
      );
      try {
        const childTrackerHtml = frm.fields_dict["child_tracker_html"];
        if (childTrackerHtml && childTrackerHtml.$wrapper) {
          const wrapper = childTrackerHtml.$wrapper.get(0);
          wrapper?.removeEventListener?.("__growatt_child_click", () => {
          });
        }
      } catch (e) {
      }
      const $wrapper = frm.fields_dict.child_tracker_html.$wrapper;
      if ($wrapper) {
        $($wrapper).off("click", ".child-tracker-open").on("click", ".child-tracker-open", function(ev) {
          ev.preventDefault();
          const $el = $(this);
          const doctype = $el.attr("data-doctype");
          const docname = $el.attr("data-docname");
          if (!doctype || !docname) return;
          frappe.iframe.view._open_doc_modal(doctype, docname);
        });
      }
    }
  };

  // frappe_growatt_ticket/doctype/ticket/ts/FieldEvents.ts
  var prev_main_eqp_serial_no = "";
  frappe.ui.form.on("Ticket", {
    add_child_button: async (form) => {
      if (!form.doc.name || form.doc.__islocal) {
        frappe.msgprint(__("Please save this document before adding a child ticket."));
        return;
      }
      const allowRoles = frappe.user.has_role(["Standard Employee"]);
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
    main_eqp_error_version: async (form) => {
      const date = form.doc.ext_fault_date;
      if (!date) return;
      const today = /* @__PURE__ */ new Date();
      const dateValue = new Date(date);
      if (dateValue > today) form.set_value("ext_fault_date", void 0);
    },
    ext_fault_date: async (form) => {
      const date = form.doc.ext_fault_date;
      if (!date) return;
      const today = /* @__PURE__ */ new Date();
      const dateValue = new Date(date);
      if (dateValue > today) form.set_value("ext_fault_date", void 0);
    },
    main_eqp_serial_no: async (form) => {
      ticket_utils.fields_handler(form);
      const serial_no = form.doc.main_eqp_serial_no?.trim();
      if (!serial_no?.length) return unsetFields(form);
      const proceed = agt.utils.validate_serial_number(serial_no) && serial_no !== prev_main_eqp_serial_no;
      if (!proceed) return unsetFields(form);
      const sn1 = await frappe.db.get_value("Serial No", serial_no, ["serial_no", "item_code", "warehouse", "company", "status"]).catch((e) => console.error(e)).then((r) => r?.message);
      if (sn1 && sn1.item_code) {
        console.log(sn1);
        form.set_value("main_eqp_serial_no", serial_no);
        form.set_value("main_eqp_model_ref", sn1.item_code);
        prev_main_eqp_serial_no = serial_no;
        return;
      }
      unsetFields(form);
      const check_mppt_routine = async function(item_name) {
        let item_info = await frappe.db.get_list(
          "Item",
          {
            filters: { item_name },
            fields: ["item_code", "mppt", "item_name"]
          }
        ).catch((e) => console.error(e));
        if (!item_info || !item_info.length) {
          const all_items = await frappe.db.get_list(
            "Item",
            {
              fields: ["item_code", "mppt", "item_name"]
            }
          ).catch((e) => console.error(e));
          if (all_items && all_items.length) {
            const normalizedInput = agt.utils.text.normalize(item_name);
            item_info = all_items.filter(
              (item) => agt.utils.text.normalize(item.item_name) === normalizedInput
            );
          }
        }
        console.log(item_info);
        if (!item_info || !item_info.length) return;
        if (item_info.length === 1) {
          form.set_value("main_eqp_serial_no", serial_no);
          form.set_value("main_eqp_model_ref", item_info?.[0]?.item_code);
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
              options: item_info.filter((item) => item.mppt != null).map((item) => item.mppt),
              reqd: true
            }
          ],
          primary_action_label: "Select",
          primary_action: async function(values) {
            const mppt = values["mppt"];
            if (!mppt) return;
            const item = item_info.find((item2) => item2.mppt === mppt);
            console.log(item);
            agt.utils.dialog.close_by_title(dialog_title);
            if (!item) return;
            form.set_value("main_eqp_serial_no", serial_no);
            form.set_value("main_eqp_model_ref", item.item_code);
            prev_main_eqp_serial_no = serial_no;
          }
        });
      };
      const sn2 = await agt.utils.get_growatt_sn_info(serial_no);
      if (!sn2 || !sn2.data || !sn2.data.model) {
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
              get_query: function() {
                return {
                  filters: [
                    ["Item", "item_group", "in", ["Inverter", "EV Charger", "Battery", "Datalogger", "Smart Meter", "Smart Energy Manager"]],
                    ["Item", "disabled", "=", 0]
                  ]
                };
              },
              reqd: true
            }
          ],
          primary_action_label: "Select",
          primary_action: async function(values) {
            const model = values["item_code"];
            if (!model) return;
            const item_info = await frappe.db.get_value("Item", { item_code: model }, ["item_code", "mppt", "item_name"]).catch((e) => console.error(e)).then((r) => r?.message);
            if (!item_info) return;
            agt.utils.dialog.close_by_title(dialog_title);
            await check_mppt_routine(item_info.item_name);
          }
        });
        return;
      }
      const filtered_name = (() => {
        const model = sn2.data.model;
        const no_growatt = model.includes("Growatt ") ? model.split("Growatt ")[1] : model;
        const no_es_model = no_growatt.includes("ES ") ? no_growatt.split("ES ")[0] + "ES" : no_growatt;
        return no_es_model;
      })();
      await check_mppt_routine(filtered_name);
      await ticket_utils.set_service_partner(form);
    },
    main_eqp_model: async (form) => {
      ticket_utils.fields_handler(form);
    }
  });
  function unsetFields(form) {
    form.set_value("main_eqp_model", void 0);
    form.set_value("main_eqp_model_ref", void 0);
    form.set_value("main_eqp_group", void 0);
    form.set_value("main_eqp_type", void 0);
    form.set_value("main_eqp_warehouse", void 0);
    form.set_value("main_eqp_mppt_number", void 0);
    form.set_value("main_eqp_family", void 0);
    form.set_value("main_eqp_error_version", void 0);
    form.set_value("main_eqp_phase", void 0);
    form.set_value("service_partner_company", void 0);
    prev_main_eqp_serial_no = "";
  }

  // frappe_growatt_ticket/doctype/ticket/ts/SubWorkflow.ts
  var subWorkflowChecklistConfig = [
    { group: "Inverter", doctype: "Service Protocol Inverter Checklist", table_field: "child_tracker_table" },
    { group: "EV Charger", doctype: "Service Protocol EV Charger Checklist", table_field: "child_tracker_table" },
    { group: "Battery", doctype: "Service Protocol Battery Checklist", table_field: "child_tracker_table" },
    { group: "Smart Meter", doctype: "Service Protocol Smart Meter Checklist", table_field: "child_tracker_table" },
    { group: "Smart Energy Manager", doctype: "Service Protocol Smart Energy Manager Checklist", table_field: "child_tracker_table" },
    { group: "Datalogger", doctype: "Service Protocol Datalogger Checklist", table_field: "child_tracker_table" }
  ];
  var subWorkflowList = {
    "Initial Analysis": ["Checklist", "Proposed Dispatch"],
    "Checklist": ["Compliance Statement", "Proposed Dispatch"],
    "Proposed Dispatch": ["Compliance Statement"],
    "Compliance Statement": ["Logistics"]
  };
  async function handleInitialAnalysis(form) {
    const dt_name = "Initial Analysis";
    const fieldname = "child_tracker_table";
    if (form._subworkflow_creating) return;
    form._subworkflow_creating = true;
    try {
      const existingInitialAnalysis = await frappe.db.get_list(dt_name, {
        filters: { ticket_docname: form.doc.name },
        fields: ["name"]
      });
      if (existingInitialAnalysis && existingInitialAnalysis.length > 0) {
        const existing_list_html = existingInitialAnalysis.map((sp) => `<li>${sp.name}</li>`).join("");
        console.warn(`Already exists a ${dt_name} linked to this Ticket: <br><ul>${existing_list_html}</ul>`);
        return;
      }
      const freshProtocols = await frappe.db.get_list(dt_name, {
        filters: { ticket_docname: form.doc.name },
        fields: ["name"]
      });
      if (freshProtocols && freshProtocols.length > 0) return;
      const docname = await agt.utils.doc.create_doc(dt_name, { ticket_docname: "docname" }, form.fields_dict);
      if (!docname) throw new Error(`Falha ao criar ${dt_name}`);
      const checklist_doc = await frappe.db.get_value(dt_name, docname, ["workflow_state"]);
      const workflow_state = checklist_doc?.message?.workflow_state || "Draft";
      await agt.utils.table.row.add_one(form, fieldname, {
        child_tracker_docname: docname,
        child_tracker_doctype: dt_name,
        child_tracker_workflow_state: workflow_state
      });
      await form.set_value("sub_workflow", "Initial Analysis");
      form.doc["sub_workflow"] = "Initial Analysis";
      form.dirty();
      await form.save();
    } finally {
      form._subworkflow_creating = false;
    }
  }
  async function recoverInitialAnalysisSoftLock(form) {
    const dt_name = "Initial Analysis";
    const sub_workflow_value = form.doc["sub_workflow"];
    if (sub_workflow_value !== "Initial Analysis") return;
    const existingInitialAnalysis = await frappe.db.get_list(dt_name, {
      filters: { ticket_docname: form.doc.name },
      fields: ["name"]
    });
    if (existingInitialAnalysis && existingInitialAnalysis.length > 0) return;
    console.warn(`\u26A0\uFE0F Soft lock detected: sub_workflow is in 'Initial Analysis' but there is no Initial Analysis linked. Creating automatically...`);
    await handleInitialAnalysis(form);
  }
  async function handleChecklist(form) {
    const main_eqp_group = form.doc["main_eqp_group"];
    const pair = subWorkflowChecklistConfig.find((c) => c.group === main_eqp_group);
    if (!pair) throw new Error(`Equipment group is not '${main_eqp_group}'`);
    const [doctype, fieldname] = [pair.doctype, pair.table_field];
    if (form._subworkflow_creating) return;
    form._subworkflow_creating = true;
    try {
      const trackerRows = form.doc[fieldname];
      if (trackerRows?.length) {
        const not_rejected = trackerRows.filter(
          (cit) => cit.child_tracker_workflow_state !== agt.metadata.doctype.initial_analysis.workflow_state.rejected.name && cit.child_tracker_doctype === doctype
        );
        if (not_rejected?.length) {
          const available_list_html = not_rejected.map((cit) => `<li> ${cit.child_tracker_docname || cit.name || "No name"} </li>`).join("");
          console.warn(`Already exists a ${doctype} linked to this Ticket: <br><ul>${available_list_html}</ul>`);
          await form.set_value("sub_workflow", "Checklist");
          form.doc["sub_workflow"] = "Checklist";
          form.dirty();
          await form.save();
          return;
        }
      }
      const freshRows = form.doc[fieldname];
      if (freshRows?.some((cit) => cit.child_tracker_doctype === doctype)) return;
      const docname = await agt.utils.doc.create_doc(doctype, { ticket_docname: "docname" }, form.fields_dict);
      if (!docname) throw new Error(`Failed to create ${doctype}`);
      const checklist_doc = await frappe.db.get_value(doctype, docname, ["workflow_state"]);
      const workflow_state = checklist_doc?.message?.workflow_state || "Draft";
      await agt.utils.table.row.add_one(form, fieldname, {
        child_tracker_docname: docname,
        child_tracker_doctype: doctype,
        child_tracker_workflow_state: workflow_state
      });
      await form.set_value("sub_workflow", "Checklist");
      form.doc["sub_workflow"] = "Checklist";
      form.dirty();
      await form.save();
    } finally {
      form._subworkflow_creating = false;
    }
  }
  async function handleProposedDispatch(form) {
    const dt_name = "Proposed Dispatch";
    const fieldname = "child_tracker_table";
    const main_eqp_group = form.doc["main_eqp_group"];
    const pair = subWorkflowChecklistConfig.find((c) => c.group === main_eqp_group);
    if (!pair) throw new Error(`Grupo do equipamento n\xE3o \xE9 '${main_eqp_group}'`);
    if (form._subworkflow_creating) return;
    form._subworkflow_creating = true;
    try {
      const checklist_doctype = pair.doctype;
      const checklist_fieldname = pair.table_field;
      const trackerRows = form.doc[checklist_fieldname];
      const completedChecklist = trackerRows?.find(
        (cit) => cit.child_tracker_doctype === checklist_doctype && (cit.child_tracker_workflow_state === agt.metadata.doctype.initial_analysis.workflow_state.finished.name || cit.child_tracker_workflow_state === "Conclu\xEDdo")
      );
      if (!completedChecklist) {
        console.warn(`There is no Checklist of type '${checklist_doctype}' with status 'Completed' for this Ticket. Proposed Dispatch will not be created.`);
        return;
      }
      const existingPD = await frappe.db.get_list(dt_name, {
        filters: { ticket_docname: form.doc.name },
        fields: ["name"]
      });
      if (existingPD && existingPD.length > 0) {
        const existing_list_html = existingPD.map((sp) => `<li>${sp.name}</li>`).join("");
        console.warn(`Already exists a ${dt_name} linked to this Ticket: <br><ul>${existing_list_html}</ul>`);
        return;
      }
      const freshPD = await frappe.db.get_list(dt_name, {
        filters: { ticket_docname: form.doc.name },
        fields: ["name"]
      });
      if (freshPD && freshPD.length > 0) return;
      const docname = await agt.utils.doc.create_doc(dt_name, { ticket_docname: "docname" }, form.fields_dict);
      if (!docname) throw new Error(`Failed to create ${dt_name}`);
      const pd_doc = await frappe.db.get_value(dt_name, docname, ["workflow_state"]);
      const workflow_state = pd_doc?.message?.workflow_state || "Draft";
      await agt.utils.table.row.add_one(form, fieldname, {
        child_tracker_docname: docname,
        child_tracker_doctype: dt_name,
        child_tracker_workflow_state: workflow_state
      });
      await form.set_value("sub_workflow", "Proposed Dispatch");
      form.doc["sub_workflow"] = "Proposed Dispatch";
      form.dirty();
      await form.save();
    } finally {
      form._subworkflow_creating = false;
    }
  }
  async function handleComplianceStatement(form) {
    const dt_name = "Compliance Statement";
    const fieldname = "child_tracker_table";
    const main_eqp_group = form.doc["main_eqp_group"];
    const pair = subWorkflowChecklistConfig.find((c) => c.group === main_eqp_group);
    if (!pair) throw new Error(`Grupo do equipamento n\xE3o \xE9 '${main_eqp_group}'`);
    if (form._subworkflow_creating) return;
    form._subworkflow_creating = true;
    try {
      const checklist_doctype = pair.doctype;
      const checklist_fieldname = pair.table_field;
      const trackerRows = form.doc[checklist_fieldname];
      const completedChecklist = trackerRows?.find(
        (cit) => cit.child_tracker_doctype === checklist_doctype && (cit.child_tracker_workflow_state === agt.metadata.doctype.initial_analysis.workflow_state.finished.name || cit.child_tracker_workflow_state === "Conclu\xEDdo")
      );
      if (!completedChecklist) {
        console.warn(`There is no Checklist of type '${checklist_doctype}' with status 'Completed' for this Ticket. Compliance Statement will not be created.`);
        return;
      }
      const existingComplianceStatement = await frappe.db.get_list(dt_name, {
        filters: { ticket_docname: form.doc.name },
        fields: ["name"]
      });
      if (existingComplianceStatement && existingComplianceStatement.length > 0) {
        const existing_list_html = existingComplianceStatement.map((sp) => `<li>${sp.name}</li>`).join("");
        console.warn(`Already exists a ${dt_name} linked to this Ticket: <br><ul>${existing_list_html}</ul>`);
        return;
      }
      const freshCompliance = await frappe.db.get_list(dt_name, {
        filters: { ticket_docname: form.doc.name },
        fields: ["name"]
      });
      if (freshCompliance && freshCompliance.length > 0) return;
      const docname = await agt.utils.doc.create_doc(dt_name, { ticket_docname: "docname" }, form.fields_dict);
      if (!docname) throw new Error(`Falha ao criar ${dt_name}`);
      const checklist_doc = await frappe.db.get_value(dt_name, docname, ["workflow_state"]);
      const workflow_state = checklist_doc?.message?.workflow_state || "Draft";
      await agt.utils.table.row.add_one(form, fieldname, {
        child_tracker_docname: docname,
        child_tracker_doctype: dt_name,
        child_tracker_workflow_state: workflow_state
      });
      await form.set_value("sub_workflow", "Compliance Statement");
      form.doc["sub_workflow"] = "Compliance Statement";
      form.dirty();
      await form.save();
    } finally {
      form._subworkflow_creating = false;
    }
  }
  var subWorkflowValidators = {
    "Checklist": async (form) => {
      const trackerRows = form.doc["child_tracker_table"];
      const hasInitialAnalysis = trackerRows?.some((row) => row.child_tracker_doctype === "Initial Analysis");
      if (!hasInitialAnalysis) return "It is necessary to create the Initial Analysis before advancing to Checklist.";
      return null;
    },
    "Compliance Statement": async (form) => {
      const main_eqp_group = form.doc["main_eqp_group"];
      const pair = subWorkflowChecklistConfig.find((c) => c.group === main_eqp_group);
      if (!pair) return `Equipment group is not '${main_eqp_group}'`;
      const checklist_doctype = pair.doctype;
      const trackerRows = form.doc[pair.table_field];
      const completedChecklist = trackerRows?.find(
        (cit) => cit.child_tracker_doctype === checklist_doctype && (cit.child_tracker_workflow_state === agt.metadata.doctype.initial_analysis.workflow_state.finished.name || cit.child_tracker_workflow_state === "Conclu\xEDdo")
      );
      if (!completedChecklist) return `Checklist of type '${checklist_doctype}' needs to be completed to advance to Compliance Statement.`;
      return null;
    }
    // Add other validations as needed
  };
  function moveFowardButton(form) {
    if (!frappe.boot.user.roles.includes("System Manager")) return;
    const $button = cur_frm.add_custom_button(__("Avan\xE7ar subetapa"), async () => {
      const current = form.doc["sub_workflow"];
      const nextSteps = subWorkflowList[current] || [];
      if (!nextSteps.length) {
        frappe.msgprint(__("No next steps available."));
        return;
      }
      const dialogTitle = __("Advance substep");
      agt.utils.dialog.load({
        title: dialogTitle,
        fields: [
          {
            fieldname: "next_status",
            label: __("Next substep"),
            fieldtype: "Select",
            options: nextSteps.join("\n"),
            reqd: true
          }
        ],
        primary_action_label: __("Advance"),
        primary_action: async (values) => {
          const status = values.next_status;
          if (subWorkflowValidators[status]) {
            const errorMsg = await subWorkflowValidators[status](form);
            if (errorMsg) {
              frappe.msgprint({
                title: __("Criteria not met"),
                message: errorMsg,
                indicator: "red"
              });
              agt.utils.dialog.close_by_title(dialogTitle);
              return;
            }
          }
          frappe.confirm(
            __("Confirming will create a doctype of type <b>" + status + "</b> and this action is irreversible. Do you want to proceed?"),
            async () => {
              await form.set_value("sub_workflow", status);
              form.doc["sub_workflow"] = status;
              form.dirty();
              await form.save();
              frappe.msgprint(__("Substep advanced to: " + status));
              agt.utils.dialog.close_by_title(dialogTitle);
            },
            () => {
              frappe.msgprint(__("Action cancelled."));
              agt.utils.dialog.close_by_title(dialogTitle);
            }
          );
        }
      });
    });
    if ($button && $button.length) {
      $button.removeClass("btn-default btn-secondary btn-success btn-warning btn-danger btn-info btn-light btn-dark");
      if (!$button.hasClass("btn")) $button.addClass("btn");
      $button.addClass("btn-primary");
      if ($button.parent().find(".sub-workflow-indicator").length === 0) {
        const $pill = $(`
        <span class="indicator-pill red sub-workflow-indicator" style="margin-right: 6px; vertical-align: middle;">
          <span class="indicator-label">${__("Substep")}: ${form.doc["sub_workflow"] || ""}</span>
        </span>
      `);
        $button.before($pill);
      } else {
        $button.parent().find(".sub-workflow-indicator .indicator-label").html(`<strong>${__("Substep")}:</strong> ${form.doc["sub_workflow"] || ""}`);
      }
    }
  }
  var sub_workflow = {
    pre_actions: async function(form) {
      const workflow_state = form.doc.workflow_state;
      const sub_workflow_value = form.doc["sub_workflow"];
      if (!form.doc || form.doc.__islocal || !form.doc.name || !form.doc.creation || typeof form.doc.creation !== "string" || form.doc.creation.length === 0) {
        return;
      }
      if (workflow_state != agt.metadata.doctype.ticket.workflow_state.draft.name && workflow_state != agt.metadata.doctype.ticket.workflow_state.active.name) {
        return;
      }
      await recoverInitialAnalysisSoftLock(form);
      if (sub_workflow_value !== "Initial Analysis" && (sub_workflow_value === "" || sub_workflow_value === null || sub_workflow_value === void 0)) {
        await handleInitialAnalysis(form);
      }
      if (sub_workflow_value !== "Checklist" && sub_workflow_value === "Initial Analysis") {
        await handleChecklist(form);
      }
      if (sub_workflow_value !== "Proposed Dispatch" && (sub_workflow_value === "Checklist" || sub_workflow_value === "Compliance Statement")) {
        await handleProposedDispatch(form);
      }
      if (sub_workflow_value !== "Compliance Statement" && (sub_workflow_value === "Proposed Dispatch" || sub_workflow_value === "Checklist")) {
        await handleComplianceStatement(form);
      }
      moveFowardButton(form);
    }
  };

  // frappe_growatt_ticket/doctype/ticket/ts/Setup.ts
  frappe.provide("frappe_growatt_ticket.setup");
  frappe_growatt_ticket.setup = {
    run: async (form) => {
      if (!frappe_growatt_ticket) return;
      frappe_growatt_ticket.src_form = cur_frm;
      await agt.corrections_tracker.run.run();
      if (!globalThis.workflow_preactions) {
        globalThis.workflow_preactions = {};
      }
      frappe.ui.form.on(form.doctype, "before_workflow_action", async () => {
        await agt.workflow.validate();
        await agt.workflow.pre_action();
      });
      frappe.ui.form.on(form.doctype, "refresh", async () => {
        await agt.workflow.load_history_field();
      });
      frappe.ui.form.on(form.doctype, "after_save", async () => {
        await agt.workflow.validate("SAVE");
      });
      frappe.ui.form.on(form.doctype, "onload", async () => {
        await agt.workflow.validate("LOAD");
      });
    }
  };

  // frappe_growatt_ticket/doctype/ticket/ts/FormEvents.ts
  frappe.ui.form.on("Ticket", {
    setup: async (form) => {
      if (form.doc.main_eqp_serial_no) {
        agt.utils.validate_serial_number(form.doc.main_eqp_serial_no);
      }
      await frappe_growatt_ticket.setup.run(form);
      ticket_utils.fields_listener(form);
    },
    before_save: async (form) => {
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
    onload: async (form) => {
      frappe.tooltip.showUserTips({
        form,
        doctype: "Tooltip",
        docnames: ["1", "1"]
      });
      ticket_utils.fields_listener(form);
      ticket_utils.runSync(form);
      await ticket_utils.set_service_partner(form);
      await ticket_utils.trigger_create_sn_into_db(form);
      await sub_workflow.pre_actions(form);
      if (form.doc.__islocal) {
        form.set_df_property("main_eqp_serial_no", "read_only", 0);
      }
    },
    refresh: async (form) => {
      ticket_utils.runSync(form);
      ticket_utils.fields_listener(form);
      await ticket_utils.set_service_partner(form);
      await ticket_utils.trigger_create_sn_into_db(form);
      await sub_workflow.pre_actions(form);
    },
    before_load: async (form) => {
      ticket_utils.fields_listener(form);
    },
    validate: async (form) => {
      ticket_utils.fields_listener(form);
      if (!form.doc.__islocal) return;
      const main_eqp_serial_no = form.doc.main_eqp_serial_no;
      if (!main_eqp_serial_no) return;
      const serial_no = await frappe.db.get_value("Serial No", { serial_no: main_eqp_serial_no }, ["serial_no", "item_code", "warehouse", "company", "status"]).catch((e) => console.error(e)).then((r) => r?.message);
      if (serial_no) {
        const initial_analysis = await frappe.db.get_list("Ticket", {
          filters: { main_eqp_serial_no },
          fields: ["name", "docstatus"]
        }).catch((e) => console.error(e));
        if (initial_analysis && initial_analysis.length > 0) {
          for (let sp of initial_analysis) {
            if (sp.docstatus === 0) {
              frappe.throw(__(` Serial number already has an active ticket: ${sp.name}`));
              return;
            }
          }
        }
      }
    }
  });

  // frappe_growatt_ticket/doctype/ticket/ts/WorkflowPreActions.ts
  var preActionsChecklistConfig = [
    { group: "Inverter", doctype: "Service Protocol Inverter Checklist", table_field: "child_tracker_table" },
    { group: "EV Charger", doctype: "Service Protocol EV Charger Checklist", table_field: "child_tracker_table" },
    { group: "Battery", doctype: "Service Protocol Battery Checklist", table_field: "child_tracker_table" },
    { group: "Smart Meter", doctype: "Service Protocol Smart Meter Checklist", table_field: "child_tracker_table" },
    { group: "Smart Energy Manager", doctype: "Service Protocol Smart Energy Manager Checklist", table_field: "child_tracker_table" },
    { group: "Datalogger", doctype: "Service Protocol Datalogger Checklist", table_field: "child_tracker_table" }
  ];
  var createPreAnalysis = {
    create_pre_analysis: async (frm) => {
      const swa = frm.states.frm.selected_workflow_action;
      const ws = frm.doc.workflow_state;
      const state = agt.metadata.doctype.ticket.workflow_state.draft.name;
      const action = agt.metadata.doctype.ticket.workflow_action.approve.name;
      const dt_name = "Initial Analysis";
      const fieldname = "child_tracker_table";
      if (ws !== state || swa !== action)
        throw new Error(`Failed to advance workflow! The workflow state must be '${state}' and the selected action must be '${action}'.`);
      const existingInitialAnalysis = await frappe.db.get_list(dt_name, {
        filters: { ticket_docname: frm.doc.name },
        fields: ["name"],
        limit: 1
      });
      if (existingInitialAnalysis && existingInitialAnalysis.length > 0) {
        const existing_list_html = existingInitialAnalysis.map((sp) => `<li>${sp.name}</li>`).join("");
        throw new Error(`A ${dt_name} is already linked to this Ticket: <br><ul>${existing_list_html}</ul>`);
      }
      try {
        console.log(`Creating ${dt_name} for Ticket ${frm.doc.name}`);
        const docname = await agt.utils.doc.create_doc(dt_name, { ticket_docname: "docname" }, frm.fields_dict);
        if (!docname) {
          throw new Error(`Failed to create ${dt_name}`);
        }
        console.log(`Initial Analysis created successfully: ${docname}`);
        console.log(`Fetching workflow state for ${docname}`);
        const checklist_doc = await frappe.db.get_value(dt_name, docname, ["workflow_state"]);
        const workflow_state = checklist_doc?.message?.workflow_state || "Draft";
        console.log(`Workflow state obtained: ${workflow_state}`);
        console.log(`Adding entry to table ${fieldname}`);
        await agt.utils.table.row.add_one(frm, fieldname, {
          child_tracker_docname: docname,
          child_tracker_doctype: dt_name,
          child_tracker_workflow_state: workflow_state
        });
        frm.dirty();
        console.log(`Process of creating ${dt_name} completed successfully`);
      } catch (error) {
        console.error(`Erro ao processar checklist:`, error);
        throw new Error(`Erro ao processar checklist: ${error instanceof Error ? error.message : String(error)}`);
      }
      await frm.save();
    }
  };
  var preactionTechnicalAnalysis = {
    create_checklist: async (frm) => {
      const swa = frm.states.frm.selected_workflow_action;
      const ws = frm.doc.workflow_state;
      const swa_request_checklist = agt.metadata.doctype.initial_analysis.workflow_action.request_checklist.name;
      const ws_holding_action = agt.metadata.doctype.initial_analysis.workflow_state.holding_action.name;
      if (ws !== ws_holding_action || ws === void 0 || ws === "" || ws === null || swa !== swa_request_checklist || swa === void 0 || swa === "" || swa === null) {
        throw new Error(`Unable to create checklist: workflow criteria not met.`);
      }
      const main_eqp_group = frm.doc["main_eqp_group"];
      const pair = preActionsChecklistConfig.find((c) => c.group === main_eqp_group);
      if (!pair) throw new Error(`Equipment group is not '${main_eqp_group}'`);
      const [doctype, fieldname] = [pair.doctype, pair.table_field];
      const trackerRows = frm.doc[fieldname];
      if (trackerRows?.length) {
        const not_rejected = trackerRows.filter(
          (cit) => cit.child_tracker_workflow_state !== agt.metadata.doctype.initial_analysis.workflow_state.rejected.name && cit.child_tracker_doctype === doctype
        );
        if (not_rejected?.length) {
          const available_list_html = not_rejected.map((cit) => `<li> ${cit.child_tracker_docname || cit.name || "No name"} </li>`).join("");
          throw new Error(`There are already one or more open checklists for this protocol: <br><ul>${available_list_html}</ul>`);
        }
      }
      try {
        console.log(`Creating checklist for ${doctype}`);
        const docname = await agt.utils.doc.create_doc(doctype, { ticket_docname: "docname" }, frm.fields_dict);
        if (!docname) {
          throw new Error(`Falha ao criar checklist '${doctype}'`);
        }
        console.log(`Checklist criado com sucesso: ${docname}`);
        console.log(`Buscando estado do workflow para ${docname}`);
        const checklist_doc = await frappe.db.get_value(doctype, docname, ["workflow_state"]);
        const workflow_state = checklist_doc?.message?.workflow_state || "Draft";
        console.log(`Estado do workflow obtido: ${workflow_state}`);
        console.log(`Adicionando entrada na tabela ${fieldname}`);
        await agt.utils.table.row.add_one(frm, fieldname, {
          child_tracker_docname: docname,
          child_tracker_doctype: doctype,
          child_tracker_workflow_state: workflow_state
        });
        frm.dirty();
        console.log(`Processo de cria\xE7\xE3o de checklist conclu\xEDdo com sucesso`);
      } catch (error) {
        console.error(`Erro ao processar checklist:`, error);
        throw new Error(`Erro ao processar checklist: ${error instanceof Error ? error.message : String(error)}`);
      }
      await frm.save();
    }
  };
  var wp = {
    ["Solicitar An\xE1lise"]: {
      "Create Initial Analysis": createPreAnalysis.create_pre_analysis
    },
    // [agt.metadata.doctype.initial_analysis.workflow_action.forward_to_support.name]: {
    //   "Decide Service Partner": preactionFowardToSupport.check_service_partner,
    // },
    [agt.metadata.doctype.initial_analysis.workflow_action.request_checklist.name]: {
      "Create 'Checklist'": preactionTechnicalAnalysis.create_checklist
    }
    // [agt.metadata.doctype.initial_analysis.workflow_action.finish_service.name]: {
    //   "Finish Protocol": preactionFinish.trigger_finish
    // },
    // [agt.metadata.doctype.initial_analysis.workflow_action.request_documentation.name]: {
    //   "Create 'Compliance Statement'": preactionRequestDoc.create_compliance_statement
    // }
  };
  frappe.ui.form.on("Ticket", "before_load", async () => {
    if (!globalThis.workflow_preactions) {
      globalThis.workflow_preactions = {};
    }
    Object.assign(globalThis.workflow_preactions, wp);
  });

  // frappe_growatt_ticket/doctype/ticket/ts/WorkflowValidations.ts
  var workflow_validations = [
    {
      workflow_state: "Rascunho",
      workflow_action: "Solicitar An\xE1lise",
      action_extended: ["SAVE", "LOAD"],
      workflow_fields: [
        {
          name: "main_customer_email",
          depends_on: (frm) => {
            const email = frm.doc.main_customer_email;
            if (!email || email.trim() === "") {
              return `O campo ${frm.fields_dict["main_customer_email"]?.df?.label ?? "main_customer_email"} deve estar preenchido.`;
            }
            return void 0;
          }
        },
        {
          name: "main_eqp_serial_no",
          depends_on: (frm) => {
            const email = frm.doc.main_eqp_serial_no;
            if (!email || email.trim() === "") {
              return `O campo ${frm.fields_dict["main_eqp_serial_no"]?.df?.label ?? "main_eqp_serial_no"} deve estar preenchido.`;
            }
            return void 0;
          }
        },
        {
          name: "main_eqp_model_ref",
          depends_on: (frm) => {
            const email = frm.doc.main_eqp_model_ref;
            if (!email || email.trim() === "") {
              return `O campo ${frm.fields_dict["main_eqp_model_ref"]?.df?.label ?? "main_eqp_model_ref"} deve estar preenchido.`;
            }
            return void 0;
          }
        },
        {
          name: "main_eqp_model_ref",
          depends_on: (frm) => {
            const email = frm.doc.main_eqp_model_ref;
            if (!email || email.trim() === "") {
              return `O campo ${frm.fields_dict["main_eqp_model_ref"]?.df?.label ?? "main_eqp_model_ref"} deve estar preenchido.`;
            }
            return void 0;
          }
        }
      ]
    }
  ];
  if (!globalThis.workflow_validations) {
    globalThis.workflow_validations = [];
  }
  globalThis.workflow_validations.push(...workflow_validations);
})();
