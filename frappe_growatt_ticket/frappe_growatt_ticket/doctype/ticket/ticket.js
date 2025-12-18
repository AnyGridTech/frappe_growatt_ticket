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
        await agt.utils.doc.update_doc("Checklist of Inverter", row.checklist_docname, clean_dict);
        await agt.utils.doc.share_doc("Checklist of Inverter", row.checklist_docname, shared_users);
      });
      wcc?.forEach(async (row) => {
        await agt.utils.doc.update_doc("Checklist of EV Charger", row.checklist_docname, clean_dict);
        await agt.utils.doc.share_doc("Checklist of EV Charger", row.checklist_docname, shared_users);
      });
      wcb?.forEach(async (row) => {
        await agt.utils.doc.update_doc("Checklist of Battery", row.checklist_docname, clean_dict);
        await agt.utils.doc.share_doc("Checklist of Battery", row.checklist_docname, shared_users);
      });
      wcs?.forEach(async (row) => {
        await agt.utils.doc.update_doc("Checklist of Smart Meter", row.checklist_docname, clean_dict);
        await agt.utils.doc.share_doc("Checklist of Smart Meter", row.checklist_docname, shared_users);
      });
      wcem?.forEach(async (row) => {
        await agt.utils.doc.update_doc("Checklist of Smart Energy Manager", row.checklist_docname, clean_dict);
        await agt.utils.doc.share_doc("Checklist of Smart Energy Manager", row.checklist_docname, shared_users);
      });
      wcd?.forEach(async (row) => {
        await agt.utils.doc.update_doc("Checklist of Datalogger", row.checklist_docname, clean_dict);
        await agt.utils.doc.share_doc("Checklist of Datalogger", row.checklist_docname, shared_users);
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
    fields_handler: async function fields_handler(frm) {
      agt.utils.form.set_button_primary_style(frm, "add_child_button");
      agt.utils.form.set_button_primary_style(frm, "add_pre_order_button");
      await ticket_utils.check_pre_order_button_visibility(frm);
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
    check_pre_order_button_visibility: async function(frm) {
      if (!frm.doc.name || frm.doc.__islocal) {
        frm.set_df_property("add_pre_order_button", "hidden", 1);
        return;
      }
      try {
        const existingDispatches = await frappe.db.get_list("Proposed Dispatch", {
          filters: { ticket_docname: frm.doc.name },
          fields: ["name"],
          limit: 1
        });
        if (existingDispatches?.length) {
          frm.set_df_property("add_pre_order_button", "hidden", 1);
          return;
        }
        const initialAnalysisAll = await frappe.db.get_list("Initial Analysis", {
          filters: { ticket_docname: frm.doc.name },
          fields: ["name", "workflow_state"]
        });
        const initialAnalysis = initialAnalysisAll.filter((doc) => doc.workflow_state === "Finished");
        if (initialAnalysis?.length) {
          frm.set_df_property("add_pre_order_button", "hidden", 0);
          return;
        }
        const checklistTypes = [
          "Checklist of Inverter",
          "Checklist of EV Charger",
          "Checklist of Battery",
          "Checklist of Smart Meter",
          "Checklist of Smart Energy Manager",
          "Checklist of Datalogger"
        ];
        for (const checklistType2 of checklistTypes) {
          const allChecklists = await frappe.db.get_list(checklistType2, {
            filters: { ticket_docname: frm.doc.name },
            fields: ["name", "workflow_state"]
          });
          const checklists = allChecklists.filter((doc) => doc.workflow_state === "Finished");
          if (checklists && checklists.length > 0) {
            frm.set_df_property("add_pre_order_button", "hidden", 0);
            return;
          }
        }
        frm.set_df_property("add_pre_order_button", "hidden", 1);
      } catch (error) {
        console.error("Error checking pre-order button visibility:", error);
        frm.set_df_property("add_pre_order_button", "hidden", 1);
      }
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
        "Checklist of Inverter",
        "Checklist of EV Charger",
        "Checklist of Battery",
        "Checklist of Smart Meter",
        "Checklist of Smart Energy Manager",
        "Checklist of Datalogger",
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
            label: __("View Document"),
            formatter: (value, doc) => {
              if (!value || !doc["child_tracker_doctype"]) return String(value || "");
              return `<a href="#" class="child-tracker-open" data-doctype="${String(doc["child_tracker_doctype"]).replace(/\"/g, "&quot;")}" data-docname="${String(value).replace(/\"/g, "&quot;")}">${String(value)} <i class="fa fa-external-link" style="font-size: 1.25em; color: var(--text-muted)"></i></a>`;
            }
          },
          {
            fieldname: "child_tracker_doctype",
            label: __("Document Type"),
            formatter: (value) => {
              if (!value) return String(value || "");
              const slug = String(value).toLowerCase().replace(/\s+/g, "-");
              return `<a href="/app/${slug}" target="_blank">${String(value)}</a>`;
            }
          },
          {
            fieldname: "child_tracker_workflow_state",
            label: __("Document Status"),
            formatter: (value, doc) => {
              if (!value) return String(value || "");
              const state = String(value);
              const stateColorMap = {
                "Draft": "orange",
                "Active": "blue",
                "Approved": "green",
                "Rejected": "red",
                "Cancelled": "grey",
                "Finished": "green",
                "Preliminary Analysis": "purple",
                "Customer: Correct Information": "orange",
                "Customer: Complete Form": "orange",
                "Review": "yellow",
                "Checklist": "blue",
                "Dispatch Proposal": "purple",
                "Compliance Statement": "darkblue",
                "Warranty Approved": "green",
                "Customer: Action Required": "orange"
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
  var checklistType = {
    "Inverter": "Checklist of Inverter",
    "EV Charger": "Checklist of EV Charger",
    "Battery": "Checklist of Battery",
    "Smart Meter": "Checklist of Smart Meter",
    "Smart Energy Manager": "Checklist of Smart Energy Manager",
    "Datalogger": "Checklist of Datalogger"
  };
  var subWorkflow = {
    "Initial Analysis": {
      doctype: "Initial Analysis",
      requiredState: "Finished",
      dependencies: [],
      canAdvanceTo: ["Checklist"],
      skipValidation: true
    },
    "Checklist": {
      doctype: (form) => {
        const group = form.doc["main_eqp_group"];
        const doctype = checklistType[group];
        if (!doctype) throw new Error(`No checklist configured for equipment group: ${group}`);
        return doctype;
      },
      requiredState: "Finished",
      dependencies: ["Initial Analysis"],
      canAdvanceTo: [],
      prepareData: async (form) => {
        const main_eqp_has_battery = await agt.utils.get_value_from_any_doc(form, "Initial Analysis", "ticket_docname", "main_eqp_has_battery");
        const main_eqp_has_sem = await agt.utils.get_value_from_any_doc(form, "Initial Analysis", "ticket_docname", "main_eqp_has_sem");
        const main_eqp_has_sm = await agt.utils.get_value_from_any_doc(form, "Initial Analysis", "ticket_docname", "main_eqp_has_sm");
        const main_eqp_has_neutral = await agt.utils.get_value_from_any_doc(form, "Initial Analysis", "ticket_docname", "main_eqp_has_neutral");
        const main_eqp_has_transformer = await agt.utils.get_value_from_any_doc(form, "Initial Analysis", "ticket_docname", "main_eqp_has_transformer");
        const ext_fault_date = await agt.utils.get_value_from_any_doc(form, "Initial Analysis", "ticket_docname", "ext_fault_date");
        const ext_fault_code = await agt.utils.get_value_from_any_doc(form, "Initial Analysis", "ticket_docname", "ext_fault_code");
        const ext_fault_customer_description = await agt.utils.get_value_from_any_doc(form, "Initial Analysis", "ticket_docname", "ext_fault_customer_description");
        return {
          main_eqp_has_battery,
          main_eqp_has_sem,
          main_eqp_has_sm,
          main_eqp_has_neutral,
          main_eqp_has_transformer,
          ext_fault_date,
          ext_fault_code,
          ext_fault_customer_description
        };
      }
    },
    "Proposed Dispatch": {
      doctype: "Proposed Dispatch",
      requiredState: "Finished",
      dependencies: ["Initial Analysis"],
      canAdvanceTo: ["Compliance Statement"]
    },
    "Compliance Statement": {
      doctype: "Compliance Statement",
      requiredState: "Finished",
      dependencies: ["Proposed Dispatch"],
      canAdvanceTo: ["Logistics"]
    }
  };
  function resolveDoctypeName(form, subWorkflowKey) {
    const config = subWorkflow[subWorkflowKey];
    if (!config) throw new Error(`No configuration for: ${subWorkflowKey}`);
    return typeof config.doctype === "function" ? config.doctype(form) : config.doctype;
  }
  async function validateCreationFlow(form, subWorkflowKey) {
    const config = subWorkflow[subWorkflowKey];
    if (!config || !config.dependencies || config.dependencies.length === 0) {
      return { isValid: true };
    }
    for (const depKey of config.dependencies) {
      const depConfig = subWorkflow[depKey];
      if (!depConfig) continue;
      const doctypeToCheck = resolveDoctypeName(form, depKey);
      const docs = await frappe.db.get_list(doctypeToCheck, {
        filters: {
          ticket_docname: form.doc.name
        },
        fields: ["name", "workflow_state"]
      });
      const existingDocs = docs.filter((doc) => doc.workflow_state === depConfig.requiredState);
      if (existingDocs && existingDocs.length > 0) {
        return { isValid: true };
      }
    }
    const depNames = config.dependencies.map((d) => resolveDoctypeName(form, d)).join(" or ");
    const targetDoctype = resolveDoctypeName(form, subWorkflowKey);
    return {
      isValid: false,
      errorMessage: `Cannot create ${targetDoctype}: ${depNames} must be in 'Finished' state first.`
    };
  }
  async function createSubWorkflowDoctype(form, subWorkflowKey) {
    if (form._subworkflow_creating) return null;
    form._subworkflow_creating = true;
    try {
      const config = subWorkflow[subWorkflowKey];
      if (!config) throw new Error(`No configuration for: ${subWorkflowKey}`);
      const doctypeName = resolveDoctypeName(form, subWorkflowKey);
      if (!config.skipValidation) {
        const validation = await validateCreationFlow(form, subWorkflowKey);
        if (!validation.isValid) {
          console.warn(validation.errorMessage || `Cannot create ${doctypeName}.`);
          return null;
        }
      }
      const existingDocs = await frappe.db.get_list(doctypeName, {
        filters: { ticket_docname: form.doc.name },
        fields: ["name"]
      });
      if (existingDocs && existingDocs.length > 0) {
        const existing_list_html = existingDocs.map((doc2) => `<li>${doc2.name}</li>`).join("");
        console.warn(`Already exists a ${doctypeName} linked to this Ticket: <br><ul>${existing_list_html}</ul>`);
        await form.set_value("sub_workflow", subWorkflowKey);
        form.doc["sub_workflow"] = subWorkflowKey;
        form.dirty();
        await form.save();
        return null;
      }
      let additionalData = { ticket_docname: "docname" };
      if (config.prepareData) {
        const preparedData = await config.prepareData(form);
        additionalData = { ...additionalData, ...preparedData };
      }
      const docname = await agt.utils.doc.create_doc(doctypeName, additionalData, form.fields_dict);
      if (!docname) throw new Error(`Failed to create ${doctypeName}`);
      const doc = await frappe.db.get_value(doctypeName, docname, ["workflow_state"]);
      const workflow_state = doc?.message?.workflow_state || "Draft";
      await agt.utils.table.row.add_one(form, "child_tracker_table", {
        child_tracker_docname: docname,
        child_tracker_doctype: doctypeName,
        child_tracker_workflow_state: workflow_state
      });
      await form.set_value("sub_workflow", subWorkflowKey);
      form.doc["sub_workflow"] = subWorkflowKey;
      form.dirty();
      await form.save();
      frappe.show_alert({
        message: __(`${doctypeName} created successfully. Advanced to: ${subWorkflowKey}`),
        indicator: "green"
      }, 5);
      return docname;
    } finally {
      form._subworkflow_creating = false;
    }
  }
  async function handleSubWorkflowStep(form, subWorkflowKey) {
    try {
      await createSubWorkflowDoctype(form, subWorkflowKey);
    } catch (error) {
      console.error(`Error handling sub-workflow step ${subWorkflowKey}:`, error);
    }
  }
  async function recoverSubWorkflowSoftLock(form, subWorkflowKey) {
    if (form.doc["sub_workflow"] !== subWorkflowKey) return;
    try {
      const doctypeName = resolveDoctypeName(form, subWorkflowKey);
      const existingDocs = await frappe.db.get_list(doctypeName, {
        filters: { ticket_docname: form.doc.name },
        fields: ["name"]
      });
      if (existingDocs && existingDocs.length > 0) return;
      console.warn(`\u26A0\uFE0F Soft lock detected: sub_workflow is in '${subWorkflowKey}' but there is no ${doctypeName} linked. Creating automatically...`);
      await handleSubWorkflowStep(form, subWorkflowKey);
    } catch (error) {
      console.error(`Error recovering soft lock for ${subWorkflowKey}:`, error);
    }
  }
  function moveFowardButton(form) {
    if (!frappe.boot.user.roles.includes("System Manager")) return;
    const $button = cur_frm.add_custom_button(__("Avan\xE7ar subetapa"), async () => {
      const current = form.doc["sub_workflow"];
      const currentConfig = subWorkflow[current];
      const nextSteps = currentConfig?.canAdvanceTo || [];
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
          const validation = await validateCreationFlow(form, status);
          if (validation.isValid) {
            frappe.confirm(
              __("Confirming will advance to substep <b>" + status + "</b>. Do you want to proceed?"),
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
          } else {
            frappe.msgprint(__(validation.errorMessage || `Cannot advance to substep: ${status}`));
          }
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
  var orchestrator = {
    pre_actions: async function(form) {
      const workflow_state = form.doc.workflow_state;
      const sub_workflow_value = form.doc["sub_workflow"];
      if (!form.doc || form.doc.__islocal || !form.doc.name || !form.doc.creation || typeof form.doc.creation !== "string" || form.doc.creation.length === 0) {
        return;
      }
      if (workflow_state != agt.metadata.doctype.ticket.workflow_state.draft.name && workflow_state != agt.metadata.doctype.ticket.workflow_state.active.name) {
        return;
      }
      for (const subWorkflowKey of Object.keys(subWorkflow)) {
        await recoverSubWorkflowSoftLock(form, subWorkflowKey);
      }
      if (sub_workflow_value !== "Initial Analysis" && (sub_workflow_value === "" || sub_workflow_value === null || sub_workflow_value === void 0)) {
        const validation = await validateCreationFlow(form, "Initial Analysis");
        if (validation.isValid) {
          await handleSubWorkflowStep(form, "Initial Analysis");
        }
      }
      if (sub_workflow_value === "Initial Analysis" && sub_workflow_value !== "Checklist") {
        const docs = (await frappe.db.get_list("Initial Analysis", {
          filters: {
            ticket_docname: form.doc.name
          },
          fields: ["name", "workflow_state", "solution_select"]
        })).filter((doc) => doc.workflow_state === "Finished" && doc.solution_select === "Deep Analysis");
        if (docs && docs.length > 0) {
          await handleSubWorkflowStep(form, "Checklist");
        }
      }
      frappe.ui.form.on("Ticket", {
        add_pre_order_button: async (form2) => {
          const validation = await validateCreationFlow(form2, "Proposed Dispatch");
          if (validation.isValid) {
            await handleSubWorkflowStep(form2, "Proposed Dispatch");
          }
        }
      });
      if ((sub_workflow_value === "Proposed Dispatch" || sub_workflow_value === "Checklist") && sub_workflow_value !== "Compliance Statement") {
        const validation = await validateCreationFlow(form, "Compliance Statement");
        if (validation.isValid) {
          await handleSubWorkflowStep(form, "Compliance Statement");
        }
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
      await orchestrator.pre_actions(form);
      if (form.doc.__islocal) {
        form.set_df_property("main_eqp_serial_no", "read_only", 0);
      }
    },
    refresh: async (form) => {
      ticket_utils.runSync(form);
      ticket_utils.fields_listener(form);
      await ticket_utils.set_service_partner(form);
      await ticket_utils.trigger_create_sn_into_db(form);
      await orchestrator.pre_actions(form);
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
