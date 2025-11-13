
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
  "Service Protocol": ["Checklist", "Proposed Dispatch"],
  "Checklist": ["Compliance Statement", "Proposed Dispatch"],
  "Proposed Dispatch": ["Compliance Statement"],
  "Compliance Statement": ["Logistics"],
};

async function handleServiceProtocol(frm: FrappeForm) {
  const dt_name = "Service Protocol";
  const fieldname = "child_tracker_table";
  if ((frm as any)._subworkflow_creating) return;
  (frm as any)._subworkflow_creating = true;
  try {
    const existingServiceProtocols = await frappe.db.get_list(dt_name, {
      filters: { ticket_docname: frm.doc.name },
      fields: ['name'],
    });
    if (existingServiceProtocols && existingServiceProtocols.length > 0) {
      const existing_list_html = existingServiceProtocols.map(sp => `<li>${sp.name}</li>`).join("");
      console.warn(`Já existe um ${dt_name} vinculado a este Ticket: <br><ul>${existing_list_html}</ul>`);
      return;
    }
    // Checa novamente antes de criar
    const freshProtocols = await frappe.db.get_list(dt_name, {
      filters: { ticket_docname: frm.doc.name },
      fields: ['name'],
    });
    if (freshProtocols && freshProtocols.length > 0) return;
    const docname = await agt.utils.doc.create_doc(dt_name, { docname: "ticket_docname" }, frm.fields_dict);
    if (!docname) throw new Error(`Falha ao criar ${dt_name}`);
    const checklist_doc = await frappe.db.get_value(dt_name, docname, ['workflow_state']);
    const workflow_state = checklist_doc?.message?.workflow_state || 'Draft';
    await agt.utils.table.row.add_one(frm, fieldname, {
      child_tracker_docname: docname,
      child_tracker_doctype: dt_name,
      child_tracker_workflow_state: workflow_state
    });
    await frm.set_value('sub_workflow', "Service Protocol");
    frm.doc['sub_workflow'] = "Service Protocol";
    frm.dirty();
    await frm.save();
  } finally {
    (frm as any)._subworkflow_creating = false;
  }
}

async function handleChecklist(frm: FrappeForm) {
  const main_eqp_group = frm.doc['main_eqp_group'];
  const pair = subWorkflowChecklistConfig.find(c => c.group === main_eqp_group);
  if (!pair) throw new Error(`Grupo do equipamento não é '${main_eqp_group}'`);
  const [doctype, fieldname] = [pair.doctype, pair.table_field];
  if ((frm as any)._subworkflow_creating) return;
  (frm as any)._subworkflow_creating = true;
  try {
    const trackerRows = frm.doc[fieldname as keyof typeof frm.doc] as ChecklistTracker[];
    if (trackerRows?.length) {
      const not_rejected = trackerRows.filter(cit =>
        cit.child_tracker_workflow_state !== agt.metadata.doctype.service_protocol.workflow_state.rejected.name &&
        cit.child_tracker_doctype === doctype
      );
      if (not_rejected?.length) {
        const available_list_html = not_rejected.map(cit => `<li> ${cit.child_tracker_docname || cit.name || 'Sem nome'} </li>`).join("");
        console.warn(`Já existe um ${doctype} vinculado a este Ticket: <br><ul>${available_list_html}</ul>`);
        await frm.set_value('sub_workflow', "Checklist");
        frm.doc['sub_workflow'] = "Checklist";
        frm.dirty();
        await frm.save();
        return;
      }
    }
    // Checa novamente antes de criar
    const freshRows = frm.doc[fieldname as keyof typeof frm.doc] as ChecklistTracker[];
    if (freshRows?.some(cit => cit.child_tracker_doctype === doctype)) return;
    // ...aqui pode adicionar lógica de criação se necessário...
  } finally {
    (frm as any)._subworkflow_creating = false;
  }
}

async function handleProposedDispatch(frm: FrappeForm) {
  const dt_name = "Proposed Dispatch";
  const fieldname = "child_tracker_table";
  const main_eqp_group = frm.doc['main_eqp_group'];
  const pair = subWorkflowChecklistConfig.find(c => c.group === main_eqp_group);
  if (!pair) throw new Error(`Grupo do equipamento não é '${main_eqp_group}'`);
  if ((frm as any)._subworkflow_creating) return;
  (frm as any)._subworkflow_creating = true;
  try {
    // Checklist do tipo correto deve estar concluído
    const checklist_doctype = pair.doctype;
    const checklist_fieldname = pair.table_field;
    const trackerRows = frm.doc[checklist_fieldname as keyof typeof frm.doc] as ChecklistTracker[];
    const completedChecklist = trackerRows?.find(cit =>
      cit.child_tracker_doctype === checklist_doctype &&
      (cit.child_tracker_workflow_state === agt.metadata.doctype.service_protocol.workflow_state.finished.name ||
        cit.child_tracker_workflow_state === "Concluído")
    );
    if (!completedChecklist) {
      console.warn(`Não existe Checklist do tipo '${checklist_doctype}' com status 'Concluído' para este Ticket. Proposed Dispatch não será criado.`);
      return;
    }
    // Não criar se já existir Proposed Dispatch
    const existingPD = await frappe.db.get_list(dt_name, {
      filters: { ticket_docname: frm.doc.name },
      fields: ['name'],
    });
    if (existingPD && existingPD.length > 0) {
      const existing_list_html = existingPD.map(sp => `<li>${sp.name}</li>`).join("");
      console.warn(`Já existe um ${dt_name} vinculado a este Ticket: <br><ul>${existing_list_html}</ul>`);
      return;
    }
    // Checa novamente antes de criar
    const freshPD = await frappe.db.get_list(dt_name, {
      filters: { ticket_docname: frm.doc.name },
      fields: ['name'],
    });
    if (freshPD && freshPD.length > 0) return;
    const docname = await agt.utils.doc.create_doc(dt_name, { docname: "ticket_docname" }, frm.fields_dict);
    if (!docname) throw new Error(`Falha ao criar ${dt_name}`);
    const pd_doc = await frappe.db.get_value(dt_name, docname, ['workflow_state']);
    const workflow_state = pd_doc?.message?.workflow_state || 'Draft';
    await agt.utils.table.row.add_one(frm, fieldname, {
      child_tracker_docname: docname,
      child_tracker_doctype: dt_name,
      child_tracker_workflow_state: workflow_state
    });
    await frm.set_value('sub_workflow', "Proposed Dispatch");
    frm.doc['sub_workflow'] = "Proposed Dispatch";
    frm.dirty();
    await frm.save();
  } finally {
    (frm as any)._subworkflow_creating = false;
  }
}

async function handleComplianceStatement(frm: FrappeForm) {
  const dt_name = "Compliance Statement";
  const fieldname = "child_tracker_table";
  const main_eqp_group = frm.doc['main_eqp_group'];
  const pair = subWorkflowChecklistConfig.find(c => c.group === main_eqp_group);
  if (!pair) throw new Error(`Grupo do equipamento não é '${main_eqp_group}'`);
  if ((frm as any)._subworkflow_creating) return;
  (frm as any)._subworkflow_creating = true;
  try {
    const checklist_doctype = pair.doctype;
    const checklist_fieldname = pair.table_field;
    const trackerRows = frm.doc[checklist_fieldname as keyof typeof frm.doc] as ChecklistTracker[];
    const completedChecklist = trackerRows?.find(cit =>
      cit.child_tracker_doctype === checklist_doctype &&
      (cit.child_tracker_workflow_state === agt.metadata.doctype.service_protocol.workflow_state.finished.name ||
        cit.child_tracker_workflow_state === "Concluído")
    );
    if (!completedChecklist) {
      console.warn(`Não existe Checklist do tipo '${checklist_doctype}' com status 'Concluído' para este Ticket. Compliance Statement não será criado.`);
      return;
    }
    const existingComplianceStatement = await frappe.db.get_list(dt_name, {
      filters: { ticket_docname: frm.doc.name },
      fields: ['name'],
    });
    if (existingComplianceStatement && existingComplianceStatement.length > 0) {
      const existing_list_html = existingComplianceStatement.map(sp => `<li>${sp.name}</li>`).join("");
      console.warn(`Já existe um ${dt_name} vinculado a este Ticket: <br><ul>${existing_list_html}</ul>`);
      return;
    }
    // Checa novamente antes de criar
    const freshCompliance = await frappe.db.get_list(dt_name, {
      filters: { ticket_docname: frm.doc.name },
      fields: ['name'],
    });
    if (freshCompliance && freshCompliance.length > 0) return;
    const docname = await agt.utils.doc.create_doc(dt_name, { docname: "ticket_docname" }, frm.fields_dict);
    if (!docname) throw new Error(`Falha ao criar ${dt_name}`);
    const checklist_doc = await frappe.db.get_value(dt_name, docname, ['workflow_state']);
    const workflow_state = checklist_doc?.message?.workflow_state || 'Draft';
    await agt.utils.table.row.add_one(frm, fieldname, {
      child_tracker_docname: docname,
      child_tracker_doctype: dt_name,
      child_tracker_workflow_state: workflow_state
    });
    await frm.set_value('sub_workflow', "Compliance Statement");
    frm.doc['sub_workflow'] = "Compliance Statement";
    frm.dirty();
    await frm.save();
  } finally {
    (frm as any)._subworkflow_creating = false;
  }
}


// Validações centralizadas para cada etapa
const subWorkflowValidators: Record<string, (frm: FrappeForm) => Promise<string | null>> = {
  "Checklist": async (frm) => {
    // Só pode avançar para Checklist se existir Service Protocol vinculado
    const trackerRows = frm.doc["child_tracker_table"] as ChecklistTracker[];
    const hasServiceProtocol = trackerRows?.some(row => row.child_tracker_doctype === "Service Protocol");
    if (!hasServiceProtocol) return "É necessário criar o Service Protocol antes de avançar para Checklist.";
    return null;
  },
  "Compliance Statement": async (frm) => {
    // Só pode avançar para Compliance Statement se Checklist estiver concluído
    const main_eqp_group = frm.doc['main_eqp_group'];
    const pair = subWorkflowChecklistConfig.find(c => c.group === main_eqp_group);
    if (!pair) return `Grupo do equipamento não é '${main_eqp_group}'`;
    const checklist_doctype = pair.doctype;
    const trackerRows = frm.doc[pair.table_field as keyof typeof frm.doc] as ChecklistTracker[];
    const completedChecklist = trackerRows?.find(cit =>
      cit.child_tracker_doctype === checklist_doctype &&
      (cit.child_tracker_workflow_state === agt.metadata.doctype.service_protocol.workflow_state.finished.name ||
        cit.child_tracker_workflow_state === "Concluído")
    );
    if (!completedChecklist) return `Checklist do tipo '${checklist_doctype}' precisa estar concluído para avançar para Compliance Statement.`;
    return null;
  },
  // Adicione outras validações conforme necessário
};

function moveFowardButton(frm: FrappeForm) {
  if (!frappe.boot.user.roles.includes("System Manager")) return;

  const $button = cur_frm.add_custom_button(__("Avançar subetapa"), async () => {
    const current = frm.doc['sub_workflow'];
    const nextSteps = subWorkflowList[current] || [];
    if (!nextSteps.length) {
      frappe.msgprint(__("Não há próximas etapas disponíveis."));
      return;
    }

    agt.utils.dialog.load({
      title: __("Avançar subetapa"),
      fields: [
        {
          fieldname: "next_status",
          label: __("Próxima subetapa"),
          fieldtype: "Select",
          options: nextSteps.join("\n"),
          reqd: true
        }
      ],
      primary_action_label: __("Avançar"),
      primary_action: async (values: any) => {
        const status = values.next_status;
        // Validação centralizada
        if (subWorkflowValidators[status]) {
          const errorMsg = await subWorkflowValidators[status](frm);
          if (errorMsg) {
            frappe.msgprint({
              title: __("Critério não atendido"),
              message: errorMsg,
              indicator: "red"
            });
            return;
          }
        }
        frappe.confirm(
          __("Confirmar criará um doctype do tipo <b>" + status + "</b> e essa ação é irreversível. Deseja seguir?"),
          async () => {
            await frm.set_value('sub_workflow', status);
            frm.doc['sub_workflow'] = status;
            frappe.msgprint(__("Subetapa avançada para: " + status));
          },
          () => {
            frappe.msgprint(__("Ação cancelada."));
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
          <span class="indicator-label">${__("Subetapa")}: ${frm.doc['sub_workflow'] || ''}</span>
        </span>
      `);
      $button.before($pill);
    } else {
      $button.parent().find('.sub-workflow-indicator .indicator-label').html(`<strong>${__("Subetapa")}:<\/strong> ${frm.doc['sub_workflow'] || ''}`);
    }
  }
}

const sub_workflow = {
  pre_actions: async function (frm: FrappeForm) {
    const workflow_state = frm.doc.workflow_state;
    const sub_workflow_value = frm.doc['sub_workflow'];
    if (!frm.doc || frm.doc.__islocal || !frm.doc.name || !frm.doc.creation || typeof frm.doc.creation !== "string" || frm.doc.creation.length === 0) {
      return;
    }
    if (workflow_state != agt.metadata.doctype.ticket.workflow_state.draft.name && workflow_state != agt.metadata.doctype.ticket.workflow_state.active.name) {
      return;
    }
    if (sub_workflow_value !== "Service Protocol" && (sub_workflow_value === "" || sub_workflow_value === null || sub_workflow_value === undefined)) {
      await handleServiceProtocol(frm);
    }
    if (sub_workflow_value !== "Checklist" && (sub_workflow_value === "Service Protocol")) {
      await handleChecklist(frm);
    }
    if (sub_workflow_value !== "Proposed Dispatch" && (sub_workflow_value === "Checklist" || sub_workflow_value === "Compliance Statement")) {
      await handleProposedDispatch(frm);
    }
    if (sub_workflow_value !== "Compliance Statement" && (sub_workflow_value === "Proposed Dispatch" || sub_workflow_value === "Checklist")) {
      await handleComplianceStatement(frm);
    }
    moveFowardButton(frm); // trigger move forward button
  }
};
export { sub_workflow };
