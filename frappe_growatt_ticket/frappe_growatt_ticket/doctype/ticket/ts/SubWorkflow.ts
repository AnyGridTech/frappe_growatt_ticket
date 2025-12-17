
import { FrappeForm } from "@anygridtech/frappe-types/client/frappe/core";
import { ChecklistTracker } from "@anygridtech/frappe-agt-types/agt/doctype";

const subWorkflowChecklistConfig = [
  { group: "Inverter", doctype: "Service Protocol Inverter Checklist", table_field: "child_tracker_table" },
  { group: "EV Charger", doctype: "Service Protocol EV Charger Checklist", table_field: "child_tracker_table" },
  { group: "Battery", doctype: "Service Protocol Battery Checklist", table_field: "child_tracker_table" },
  { group: "Smart Meter", doctype: "Service Protocol Smart Meter Checklist", table_field: "child_tracker_table" },
  { group: "Smart Energy Manager", doctype: "Service Protocol Smart Energy Manager Checklist", table_field: "child_tracker_table" },
  { group: "Datalogger", doctype: "Service Protocol Datalogger Checklist", table_field: "child_tracker_table" },
];

const subWorkflowList: Record<string, string[]> = {
  "Initial Analysis": ["Checklist", "Proposed Dispatch"],
  "Checklist": ["Compliance Statement", "Proposed Dispatch"],
  "Proposed Dispatch": ["Compliance Statement"],
  "Compliance Statement": ["Logistics"],
};

async function handleInitialAnalysis(form: FrappeForm) {
  const dt_name = "Initial Analysis";
  const fieldname = "child_tracker_table";
  if ((form as any)._subworkflow_creating) return;
  (form as any)._subworkflow_creating = true;
  try {
    const existingInitialAnalysis = await frappe.db.get_list(dt_name, {
      filters: { ticket_docname: form.doc.name },
      fields: ['name'],
    });
    if (existingInitialAnalysis && existingInitialAnalysis.length > 0) {
      const existing_list_html = existingInitialAnalysis.map(sp => `<li>${sp.name}</li>`).join("");
      console.warn(`Already exists a ${dt_name} linked to this Ticket: <br><ul>${existing_list_html}</ul>`);
      return;
    }
    // Checa novamente antes de criar
    const freshProtocols = await frappe.db.get_list(dt_name, {
      filters: { ticket_docname: form.doc.name },
      fields: ['name'],
    });
    if (freshProtocols && freshProtocols.length > 0) return;
    const docname = await agt.utils.doc.create_doc(dt_name, { ticket_docname: "docname" }, form.fields_dict);
    if (!docname) throw new Error(`Falha ao criar ${dt_name}`);
    const checklist_doc = await frappe.db.get_value(dt_name, docname, ['workflow_state']);
    const workflow_state = checklist_doc?.message?.workflow_state || 'Draft';
    await agt.utils.table.row.add_one(form, fieldname, {
      child_tracker_docname: docname,
      child_tracker_doctype: dt_name,
      child_tracker_workflow_state: workflow_state
    });
    await form.set_value('sub_workflow', "Initial Analysis");
    form.doc['sub_workflow'] = "Initial Analysis";
    form.dirty();
    await form.save();
  } finally {
    (form as any)._subworkflow_creating = false;
  }
}

// Função de recuperação para soft lock: se está no subworkflow Initial Analysis mas não há nenhum vinculado
async function recoverInitialAnalysisSoftLock(form: FrappeForm) {
  const dt_name = "Initial Analysis";
  const sub_workflow_value = form.doc['sub_workflow'];
  
  // Se não está no subworkflow Initial Analysis, não precisa recuperar
  if (sub_workflow_value !== "Initial Analysis") return;
  
  // Verifica se há algum Initial Analysis vinculado
  const existingInitialAnalysis = await frappe.db.get_list(dt_name, {
    filters: { ticket_docname: form.doc.name },
    fields: ['name'],
  });
  
  // Se já existe, não precisa recuperar
  if (existingInitialAnalysis && existingInitialAnalysis.length > 0) return;
  
  // Soft lock detected: create Initial Analysis
  console.warn(`⚠️ Soft lock detected: sub_workflow is in 'Initial Analysis' but there is no Initial Analysis linked. Creating automatically...`);
  await handleInitialAnalysis(form);
}

async function handleChecklist(form: FrappeForm) {
  const main_eqp_group = form.doc['main_eqp_group'];
  const pair = subWorkflowChecklistConfig.find(c => c.group === main_eqp_group);
  if (!pair) throw new Error(`Equipment group is not '${main_eqp_group}'`);
  const [doctype, fieldname] = [pair.doctype, pair.table_field];
  if ((form as any)._subworkflow_creating) return;
  (form as any)._subworkflow_creating = true;
  try {
    const trackerRows = form.doc[fieldname as keyof typeof form.doc] as ChecklistTracker[];
    if (trackerRows?.length) {
      const not_rejected = trackerRows.filter(cit =>
        cit.child_tracker_workflow_state !== agt.metadata.doctype.initial_analysis.workflow_state.rejected.name &&
        cit.child_tracker_doctype === doctype
      );
      if (not_rejected?.length) {
        const available_list_html = not_rejected.map(cit => `<li> ${cit.child_tracker_docname || cit.name || 'No name'} </li>`).join("");
        console.warn(`Already exists a ${doctype} linked to this Ticket: <br><ul>${available_list_html}</ul>`);
        await form.set_value('sub_workflow', "Checklist");
        form.doc['sub_workflow'] = "Checklist";
        form.dirty();
        await form.save();
        return;
      }
    }
    // Checa novamente antes de criar
    const freshRows = form.doc[fieldname as keyof typeof form.doc] as ChecklistTracker[];
    if (freshRows?.some(cit => cit.child_tracker_doctype === doctype)) return;
    
    // Criar o Checklist automaticamente
    const docname = await agt.utils.doc.create_doc(doctype, { ticket_docname: "docname" }, form.fields_dict);
    if (!docname) throw new Error(`Failed to create ${doctype}`);
    
    const checklist_doc = await frappe.db.get_value(doctype, docname, ['workflow_state']);
    const workflow_state = checklist_doc?.message?.workflow_state || 'Draft';
    
    await agt.utils.table.row.add_one(form, fieldname, {
      child_tracker_docname: docname,
      child_tracker_doctype: doctype,
      child_tracker_workflow_state: workflow_state
    });
    
    await form.set_value('sub_workflow', "Checklist");
    form.doc['sub_workflow'] = "Checklist";
    form.dirty();
    await form.save();
  } finally {
    (form as any)._subworkflow_creating = false;
  }
}

async function handleProposedDispatch(form: FrappeForm) {
  const dt_name = "Proposed Dispatch";
  const fieldname = "child_tracker_table";
  const main_eqp_group = form.doc['main_eqp_group'];
  const pair = subWorkflowChecklistConfig.find(c => c.group === main_eqp_group);
  if (!pair) throw new Error(`Grupo do equipamento não é '${main_eqp_group}'`);
  if ((form as any)._subworkflow_creating) return;
  (form as any)._subworkflow_creating = true;
  try {
    // Checklist do tipo correto deve estar concluído
    const checklist_doctype = pair.doctype;
    const checklist_fieldname = pair.table_field;
    const trackerRows = form.doc[checklist_fieldname as keyof typeof form.doc] as ChecklistTracker[];
    const completedChecklist = trackerRows?.find(cit =>
      cit.child_tracker_doctype === checklist_doctype &&
      (cit.child_tracker_workflow_state === agt.metadata.doctype.initial_analysis.workflow_state.finished.name ||
        cit.child_tracker_workflow_state === "Concluído")
    );
    if (!completedChecklist) {
      console.warn(`There is no Checklist of type '${checklist_doctype}' with status 'Completed' for this Ticket. Proposed Dispatch will not be created.`);
      return;
    }
    // Não criar se já existir Proposed Dispatch
    const existingPD = await frappe.db.get_list(dt_name, {
      filters: { ticket_docname: form.doc.name },
      fields: ['name'],
    });
    if (existingPD && existingPD.length > 0) {
      const existing_list_html = existingPD.map(sp => `<li>${sp.name}</li>`).join("");
      console.warn(`Already exists a ${dt_name} linked to this Ticket: <br><ul>${existing_list_html}</ul>`);
      return;
    }
    // Checa novamente antes de criar
    const freshPD = await frappe.db.get_list(dt_name, {
      filters: { ticket_docname: form.doc.name },
      fields: ['name'],
    });
    if (freshPD && freshPD.length > 0) return;
    const docname = await agt.utils.doc.create_doc(dt_name, { ticket_docname: "docname" }, form.fields_dict);
    if (!docname) throw new Error(`Failed to create ${dt_name}`);
    const pd_doc = await frappe.db.get_value(dt_name, docname, ['workflow_state']);
    const workflow_state = pd_doc?.message?.workflow_state || 'Draft';
    await agt.utils.table.row.add_one(form, fieldname, {
      child_tracker_docname: docname,
      child_tracker_doctype: dt_name,
      child_tracker_workflow_state: workflow_state
    });
    await form.set_value('sub_workflow', "Proposed Dispatch");
    form.doc['sub_workflow'] = "Proposed Dispatch";
    form.dirty();
    await form.save();
  } finally {
    (form as any)._subworkflow_creating = false;
  }
}

async function handleComplianceStatement(form: FrappeForm) {
  const dt_name = "Compliance Statement";
  const fieldname = "child_tracker_table";
  const main_eqp_group = form.doc['main_eqp_group'];
  const pair = subWorkflowChecklistConfig.find(c => c.group === main_eqp_group);
  if (!pair) throw new Error(`Grupo do equipamento não é '${main_eqp_group}'`);
  if ((form as any)._subworkflow_creating) return;
  (form as any)._subworkflow_creating = true;
  try {
    const checklist_doctype = pair.doctype;
    const checklist_fieldname = pair.table_field;
    const trackerRows = form.doc[checklist_fieldname as keyof typeof form.doc] as ChecklistTracker[];
    const completedChecklist = trackerRows?.find(cit =>
      cit.child_tracker_doctype === checklist_doctype &&
      (cit.child_tracker_workflow_state === agt.metadata.doctype.initial_analysis.workflow_state.finished.name ||
        cit.child_tracker_workflow_state === "Concluído")
    );
    if (!completedChecklist) {
      console.warn(`There is no Checklist of type '${checklist_doctype}' with status 'Completed' for this Ticket. Compliance Statement will not be created.`);
      return;
    }
    const existingComplianceStatement = await frappe.db.get_list(dt_name, {
      filters: { ticket_docname: form.doc.name },
      fields: ['name'],
    });
    if (existingComplianceStatement && existingComplianceStatement.length > 0) {
      const existing_list_html = existingComplianceStatement.map(sp => `<li>${sp.name}</li>`).join("");
      console.warn(`Already exists a ${dt_name} linked to this Ticket: <br><ul>${existing_list_html}</ul>`);
      return;
    }
    // Checa novamente antes de criar
    const freshCompliance = await frappe.db.get_list(dt_name, {
      filters: { ticket_docname: form.doc.name },
      fields: ['name'],
    });
    if (freshCompliance && freshCompliance.length > 0) return;
    const docname = await agt.utils.doc.create_doc(dt_name, { ticket_docname: "docname" }, form.fields_dict);
    if (!docname) throw new Error(`Falha ao criar ${dt_name}`);
    const checklist_doc = await frappe.db.get_value(dt_name, docname, ['workflow_state']);
    const workflow_state = checklist_doc?.message?.workflow_state || 'Draft';
    await agt.utils.table.row.add_one(form, fieldname, {
      child_tracker_docname: docname,
      child_tracker_doctype: dt_name,
      child_tracker_workflow_state: workflow_state
    });
    await form.set_value('sub_workflow', "Compliance Statement");
    form.doc['sub_workflow'] = "Compliance Statement";
    form.dirty();
    await form.save();
  } finally {
    (form as any)._subworkflow_creating = false;
  }
}


// Validações centralizadas para cada etapa
const subWorkflowValidators: Record<string, (form: FrappeForm) => Promise<string | null>> = {
  "Checklist": async (form) => {
    // Só pode avançar para Checklist se existir Initial Analysis vinculado
    const trackerRows = form.doc["child_tracker_table"] as ChecklistTracker[];
    const hasInitialAnalysis = trackerRows?.some(row => row.child_tracker_doctype === "Initial Analysis");
    if (!hasInitialAnalysis) return "It is necessary to create the Initial Analysis before advancing to Checklist.";
    return null;
  },
  "Compliance Statement": async (form) => {
    // Só pode avançar para Compliance Statement se Checklist estiver concluído
    const main_eqp_group = form.doc['main_eqp_group'];
    const pair = subWorkflowChecklistConfig.find(c => c.group === main_eqp_group);
    if (!pair) return `Equipment group is not '${main_eqp_group}'`;
    const checklist_doctype = pair.doctype;
    const trackerRows = form.doc[pair.table_field as keyof typeof form.doc] as ChecklistTracker[];
    const completedChecklist = trackerRows?.find(cit =>
      cit.child_tracker_doctype === checklist_doctype &&
      (cit.child_tracker_workflow_state === agt.metadata.doctype.initial_analysis.workflow_state.finished.name ||
        cit.child_tracker_workflow_state === "Concluído")
    );
    if (!completedChecklist) return `Checklist of type '${checklist_doctype}' needs to be completed to advance to Compliance Statement.`;
    return null;
  },
  // Add other validations as needed
};

function moveFowardButton(form: FrappeForm) {
  if (!frappe.boot.user.roles.includes("System Manager")) return;

  const $button = cur_frm.add_custom_button(__("Avançar subetapa"), async () => {
    const current = form.doc['sub_workflow'];
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
      primary_action: async (values: any) => {
        const status = values.next_status;
        // Validação centralizada
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
            await form.set_value('sub_workflow', status);
            form.doc['sub_workflow'] = status;
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
  }) as unknown as JQuery<HTMLElement>;
  // Remove classes indesejadas e adiciona btn-primary
  if ($button && $button.length) {
    $button.removeClass('btn-default btn-secondary btn-success btn-warning btn-danger btn-info btn-light btn-dark');
    if (!$button.hasClass('btn')) $button.addClass('btn');
    $button.addClass('btn-primary');
    // // opcional: tamanho menor
    // $button.addClass('btn-sm');

    // Insere o pill de subworkflow ao lado do botão
    if ($button.parent().find('.sub-workflow-indicator').length === 0) {
      const $pill = $(`
        <span class="indicator-pill red sub-workflow-indicator" style="margin-right: 6px; vertical-align: middle;">
          <span class="indicator-label">${__("Substep")}: ${form.doc['sub_workflow'] || ''}</span>
        </span>
      `);
      $button.before($pill);
    } else {
      $button.parent().find('.sub-workflow-indicator .indicator-label').html(`<strong>${__("Substep")}:<\/strong> ${form.doc['sub_workflow'] || ''}`);
    }
  }
}

const sub_workflow = {
  pre_actions: async function (form: FrappeForm) {
    const workflow_state = form.doc.workflow_state;
    const sub_workflow_value = form.doc['sub_workflow'];
    if (!form.doc || form.doc.__islocal || !form.doc.name || !form.doc.creation || typeof form.doc.creation !== "string" || form.doc.creation.length === 0) {
      return;
    }
    if (workflow_state != agt.metadata.doctype.ticket.workflow_state.draft.name && workflow_state != agt.metadata.doctype.ticket.workflow_state.active.name) {
      return;
    }
    
    // Tenta recuperar de soft lock antes de prosseguir
    await recoverInitialAnalysisSoftLock(form);
    
    if (sub_workflow_value !== "Initial Analysis" && (sub_workflow_value === "" || sub_workflow_value === null || sub_workflow_value === undefined)) {
      await handleInitialAnalysis(form);
    }
    if (sub_workflow_value !== "Checklist" && (sub_workflow_value === "Initial Analysis")) {
      await handleChecklist(form);
    }
    if (sub_workflow_value !== "Proposed Dispatch" && (sub_workflow_value === "Checklist" || sub_workflow_value === "Compliance Statement")) {
      await handleProposedDispatch(form);
    }
    if (sub_workflow_value !== "Compliance Statement" && (sub_workflow_value === "Proposed Dispatch" || sub_workflow_value === "Checklist")) {
      await handleComplianceStatement(form);
    }
    moveFowardButton(form); // trigger move forward button
  }
};
export { sub_workflow };
