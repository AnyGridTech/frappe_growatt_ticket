import type { ChecklistTracker } from "@anygridtech/frappe-agt-types/agt/doctype";
import type { FrappeForm } from "@anygridtech/frappe-types/client/frappe/core";
import { WorkflowPreActions } from "@anygridtech/frappe-agt-types/agt/client/workflow/";

const preActionsChecklistConfig = [
  { group: "Inverter", doctype: "Service Protocol Inverter Checklist", table_field: "child_tracker_table" },
  { group: "EV Charger", doctype: "Service Protocol EV Charger Checklist", table_field: "child_tracker_table" },
  { group: "Battery", doctype: "Service Protocol Battery Checklist", table_field: "child_tracker_table" },
  { group: "Smart Meter", doctype: "Service Protocol Smart Meter Checklist", table_field: "child_tracker_table" },
  { group: "Smart Energy Manager", doctype: "Service Protocol Smart Energy Manager Checklist", table_field: "child_tracker_table" },
  { group: "Datalogger", doctype: "Service Protocol Datalogger Checklist", table_field: "child_tracker_table" },
];

// const preactionFowardToSupport = {
//   check_service_partner: async (frm: FrappeForm) => {
//     const swa = frm.states.frm.selected_workflow_action;
//     const ws = frm.doc.workflow_state;
//     // if (ws !== growatt.namespace.initial_analysis.workflow_state.customer_finish_filling.name || swa !== growatt.namespace.initial_analysis.workflow_action.forward_to_support.name) return;
//   }
// };

// Create Initial Analysis through the Ticket action trigger.
const createPreAnalysis = {
  create_pre_analysis: async (frm: FrappeForm) => {
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
      fields: ['name'],
      limit: 1
    });
    if (existingInitialAnalysis && existingInitialAnalysis.length > 0) {
      const existing_list_html = existingInitialAnalysis.map(sp => `<li>${sp.name}</li>`).join("");
      throw new Error(`A ${dt_name} is already linked to this Ticket: <br><ul>${existing_list_html}</ul>`);
    }

    try {
      console.log(`Creating ${dt_name} for Ticket ${frm.doc.name}`);

      const docname = await agt.utils.doc.create_doc(dt_name, { ticket_docname: "docname" }, frm.fields_dict);
      if (!docname) {
        throw new Error(`Failed to create ${dt_name}`);
      }
      console.log(`Initial Analysis created successfully: ${docname}`);

      // Find the workflow state of the newly created Initial Analysis
      console.log(`Fetching workflow state for ${docname}`);
      const checklist_doc = await frappe.db.get_value(dt_name, docname, ['workflow_state']);
      const workflow_state = checklist_doc?.message?.workflow_state || 'Draft';
      console.log(`Workflow state obtained: ${workflow_state}`);

      // Add row to the child table
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
    await frm.save(); // Make sure the changes will be saved
  }
};

// const preactionFinish = {
//   trigger_finish: async (frm: FrappeForm) => {
//     const swa = frm.states.frm.selected_workflow_action;
//     const ws = frm.doc.workflow_state;
//     const wsInput = growatt.namespace.initial_analysis.workflow_state.holding_action.name;
//     const wsOutput = growatt.namespace.initial_analysis.workflow_state.finished.name;
//     const swaMediator = growatt.namespace.initial_analysis.workflow_action.finish_service.name;

//     if (ws !== wsInput || swa !== swaMediator)
//       throw new Error(`Falha ao avançar workflow: o estado do workflow deve ser '${wsInput}' e a ação selecionada deve ser '${swaMediator}'.`);

//     const fieldsValidation = [
//       {
//         name: "solution_description",
//         depends_on: (frm: FrappeForm) => {
//           const ext_fault_customer_description = frm.doc.ext_fault_customer_description;
//           if (ext_fault_customer_description?.length < 15)
//             return `A descrição do label(${ext_fault_customer_description}) deve ter no mínimo 15 caracteres.`;
//         }
//       },
//       {
//         name: "solution_select",
//         depends_on: (frm: FrappeForm) => {
//           const solution_select = frm.doc.solution_select;
//           if (!solution_select) return "A solução deve ser selecionada.";
//           if (solution_select === "Abertura de Checklist") return "A solução aplicada deve ser condizente com a finalização do caso.";
//         }
//       },
//     ];
//     // Validate fields before proceeding
//     for (const field of fieldsValidation) {
//       if (field.depends_on) {
//         const error = field.depends_on(frm);
//         if (error) throw new Error(error);
//       }
//     }
//     const confirmDiag = frappe.confirm(
//       `Tem certeza que deseja avançar o workflow para '${wsOutput}'?`,
//       async () => {
//         await growatt.utils.update_workflow_state({
//           doctype: "Serial No",
//           docname: frm.doc.name,
//           workflow_state: growatt.namespace.ticket.workflow_state.finished.name,
//           ignore_workflow_validation: true
//         });
//         await frm.save();
//       },
//       () => {
//         return;
//       }
//     );
//     confirmDiag.set_primary_action("Sim");
//     confirmDiag.set_secondary_action_label("Não");
//     if (confirmDiag.set_title) confirmDiag.set_title("Confirmação");
//   }
// };
const preactionTechnicalAnalysis = {
  create_checklist: async (frm: FrappeForm) => {
    const swa = frm.states.frm.selected_workflow_action;
    const ws = frm.doc.workflow_state;
    const swa_request_checklist = agt.metadata.doctype.initial_analysis.workflow_action.request_checklist.name;
    const ws_holding_action = agt.metadata.doctype.initial_analysis.workflow_state.holding_action.name;

    // Validação centralizada: todos os critérios devem ser atendidos
    if (
      ws !== ws_holding_action ||
      ws === undefined ||
      ws === "" ||
      ws === null ||
      swa !== swa_request_checklist ||
      swa === undefined ||
      swa === "" ||
      swa === null
    ) {
      throw new Error(`Unable to create checklist: workflow criteria not met.`);
    }

    const main_eqp_group = frm.doc['main_eqp_group'];
    const pair = preActionsChecklistConfig.find(c => c.group === main_eqp_group);
    if (!pair) throw new Error(`Equipment group is not '${main_eqp_group}'`);
    const [doctype, fieldname] = [pair.doctype, pair.table_field];

    // Validação de checklists abertos
    const trackerRows = frm.doc[fieldname as keyof typeof frm.doc] as ChecklistTracker[];
    if (trackerRows?.length) {
      const not_rejected = trackerRows.filter(cit =>
        cit.child_tracker_workflow_state !== agt.metadata.doctype.initial_analysis.workflow_state.rejected.name &&
        cit.child_tracker_doctype === doctype
      );
      if (not_rejected?.length) {
        const available_list_html = not_rejected.map(cit => `<li> ${cit.child_tracker_docname || cit.name || 'No name'} </li>`).join("");
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

      // Busca o estado do workflow do checklist recém-criado
      console.log(`Buscando estado do workflow para ${docname}`);
      const checklist_doc = await frappe.db.get_value(doctype, docname, ['workflow_state']);
      const workflow_state = checklist_doc?.message?.workflow_state || 'Draft';
      console.log(`Estado do workflow obtido: ${workflow_state}`);

      // Adiciona linha à tabela de checklists
      console.log(`Adicionando entrada na tabela ${fieldname}`);
      await agt.utils.table.row.add_one(frm, fieldname, {
        child_tracker_docname: docname,
        child_tracker_doctype: doctype,
        child_tracker_workflow_state: workflow_state
      });

      frm.dirty();
      console.log(`Processo de criação de checklist concluído com sucesso`);
    } catch (error) {
      console.error(`Erro ao processar checklist:`, error);
      throw new Error(`Erro ao processar checklist: ${error instanceof Error ? error.message : String(error)}`);
    }
    await frm.save(); // Não remova
  }
};
// const preactionRequestDoc = {
//   create_compliance_statement: async (frm: FrappeForm) => {
//     const swa = frm.states.frm.selected_workflow_action;
//     const ws = frm.doc.workflow_state;
//     const swa_request_documentation = growatt.namespace.initial_analysis.workflow_action.request_documentation.name;
//     const ws_shipping_proposal = growatt.namespace.ticket.workflow_state.shippingProposal.name;

//     // Validação centralizada: todos os critérios devem ser atendidos
//     if (
//       ws !== ws_shipping_proposal ||
//       ws === undefined ||
//       ws === "" ||
//       ws === null ||
//       swa !== swa_request_documentation ||
//       swa === undefined ||
//       swa === "" ||
//       swa === null
//     ) {
//       throw new Error(`Não foi possível criar Compliance Statement: Critérios não atendidos.`);
//     }

//     const main_eqp_group = frm.doc.main_eqp_group;
//     const pair = preActionsChecklistConfig.find(c => c.group === main_eqp_group);
//     if (!pair) throw new Error(`Grupo do equipamento não é '${main_eqp_group}'`);
//     const [doctype, fieldname] = [pair.doctype, pair.table_field];

//     const checklist_table = frm.doc[fieldname] || [];
//     const shippingItems = frm.doc.proposed_dispatch_table || [];

//     if (!Array.isArray(shippingItems) || shippingItems.length === 0) {
//       throw new Error("A tabela de proposta de envio deve conter pelo menos um item.");
//     }

//     for (const item of shippingItems) {
//       if (!item.item_name || item.item_name.trim() === "") {
//         throw new Error("Todos os itens da tabela de proposta de envio devem ter o campo 'Nome do Item' preenchido.");
//       }
//       if (!item.item_quantity || item.item_quantity <= 0) {
//         throw new Error("A 'quantidade' de cada item deve ser maior ou igual a 1.");
//       }
//     }

//     // Verificar se há pelo menos um item do checklist concluído
//     const hasCompletedChecklist = checklist_table.some((row: any) => {
//       return row.child_tracker_doctype === doctype &&
//         row.child_tracker_workflow_state === "Concluído";
//     });
//     if (!hasCompletedChecklist) {
//       throw new Error(`É necessário ter pelo menos um item do checklist de ${main_eqp_group} marcado como "Concluído" antes de prosseguir.`);
//     }

//     const existing = await frappe.db.get_list('Compliance Statement', {
//       filters: { ticket_docname: frm.docname },
//       fields: ['name'],
//       limit: 1
//     });

//     if (existing && existing.length > 0) {
//       const existing_list_html = existing.map(cs => `<li>${cs.name}</li>`).join("");
//       throw new Error(`Já existe um Compliance Statement vinculado a este Ticket: <br><ul>${existing_list_html}</ul>`);
//     }

//     try {
//       console.log(`Criando Compliance Statement`);

//       const docname = await growatt.utils.create_doc("Compliance Statement", ["ticket_docname"], frm.fields_dict);

//       if (!docname) {
//         throw new Error(`Falha ao criar Compliance Statement`);
//       }

//       console.log(`Compliance Statement criado com sucesso: ${docname}`);

//       // growatt.utils.update_workflow_state({
//       //   doctype: "Ticket",
//       //   docname: cur_frm.docname,
//       //   workflow_state: growatt.namespace.ticket.workflow_state.compliance_statement.name,
//       //   ignore_workflow_validation: true,
//       // });

//       frappe.msgprint({
//         title: "Documentação Criada",
//         message: "Você será redirecionado para o documento de análise.",
//         indicator: 'blue'
//       });

//       setTimeout(() => {
//         const url = `/app/compliance-statement/${docname}`;
//         window.open(url, '_blank');
//       }, 3000);

//       frm.dirty();
//       console.log(`Processo de criação de Compliance Statement concluído com sucesso`);
//     } catch (error) {
//       console.error(`Erro ao processar Compliance Statement:`, error);
//       throw new Error(`Erro ao processar Compliance Statement: ${error instanceof Error ? error.message : String(error)}`);
//     }
//     await frm.save();
//   }
// };

const wp: WorkflowPreActions = {
  ["Solicitar Análise"]: {
    "Create Initial Analysis": createPreAnalysis.create_pre_analysis,
  },
  // [agt.metadata.doctype.initial_analysis.workflow_action.forward_to_support.name]: {
  //   "Decide Service Partner": preactionFowardToSupport.check_service_partner,
  // },
  [agt.metadata.doctype.initial_analysis.workflow_action.request_checklist.name]: {
    "Create 'Checklist'": preactionTechnicalAnalysis.create_checklist
  },
  // [agt.metadata.doctype.initial_analysis.workflow_action.finish_service.name]: {
  //   "Finish Protocol": preactionFinish.trigger_finish
  // },
  // [agt.metadata.doctype.initial_analysis.workflow_action.request_documentation.name]: {
  //   "Create 'Compliance Statement'": preactionRequestDoc.create_compliance_statement
  // }
};

frappe.ui.form.on('Ticket', 'before_load', async () => {
  if (!(globalThis as any).workflow_preactions) {
    (globalThis as any).workflow_preactions = {};
  }
  Object.assign((globalThis as any).workflow_preactions, wp);
});
