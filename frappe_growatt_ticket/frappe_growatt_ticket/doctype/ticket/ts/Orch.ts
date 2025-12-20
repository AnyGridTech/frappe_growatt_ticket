
import { FrappeForm } from "@anygridtech/frappe-types/client/frappe/core";

/**
 * Mapeamento entre grupos de equipamento e seus respectivos doctypes de checklist
 */
const checklistType: Record<string, string> = {
  "Inverter": "Checklist of Inverter",
  "EV Charger": "Checklist of EV Charger",
  "Battery": "Checklist of Battery",
  "Smart Meter": "Checklist of Smart Meter",
  "Smart Energy Manager": "Checklist of Smart Energy Manager",
  "Datalogger": "Checklist of Datalogger"
};

/**
 * Configuração completa e única do fluxo de sub-workflows
 * Define para cada etapa: dependências, próximas etapas permitidas e configurações especiais
 */
const subWorkflow: Record<string, {
  doctype: string | ((form: FrappeForm) => string);  // Nome do doctype ou função para resolver dinamicamente
  requiredState: string;                              // Estado necessário do doctype anterior
  dependencies: string[];                             // Doctypes que devem estar "Finished" para criar este
  canAdvanceTo: string[];                             // Próximas etapas permitidas pelo botão de avançar
  skipValidation?: boolean;                           // Se true, não valida dependências
  prepareData?: (form: FrappeForm) => Promise<Record<string, any>>;  // Função para preparar dados antes da criação
}> = {
  "Initial Analysis": {
    doctype: "Initial Analysis",
    requiredState: "Finished",
    dependencies: [],
    canAdvanceTo: ["Checklist", "Proposed Dispatch"],
    skipValidation: true
  },
  "Checklist": {
    doctype: (form) => {
      const group = form.doc['main_eqp_group'];
      const doctype = checklistType[group];
      if (!doctype) throw new Error(`No checklist configured for equipment group: ${group}`);
      return doctype;
    },
    requiredState: "Finished",
    dependencies: ["Initial Analysis"],
    canAdvanceTo: ["Compliance Statement", "Proposed Dispatch"],
    prepareData: async (form) => {
      // Coleta informações necessárias do Initial Analysis
      const main_eqp_has_battery = await agt.utils.get_value_from_any_doc(form, 'Initial Analysis', 'ticket_docname', 'main_eqp_has_battery');
      const main_eqp_has_sem = await agt.utils.get_value_from_any_doc(form, 'Initial Analysis', 'ticket_docname', 'main_eqp_has_sem');
      const main_eqp_has_sm = await agt.utils.get_value_from_any_doc(form, 'Initial Analysis', 'ticket_docname', 'main_eqp_has_sm');
      const main_eqp_has_neutral = await agt.utils.get_value_from_any_doc(form, 'Initial Analysis', 'ticket_docname', 'main_eqp_has_neutral');
      const main_eqp_has_transformer = await agt.utils.get_value_from_any_doc(form, 'Initial Analysis', 'ticket_docname', 'main_eqp_has_transformer');
      const ext_fault_date = await agt.utils.get_value_from_any_doc(form, 'Initial Analysis', 'ticket_docname', 'ext_fault_date');
      const ext_fault_code = await agt.utils.get_value_from_any_doc(form, 'Initial Analysis', 'ticket_docname', 'ext_fault_code');
      const ext_fault_customer_description = await agt.utils.get_value_from_any_doc(form, 'Initial Analysis', 'ticket_docname', 'ext_fault_customer_description');
      
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
    dependencies: ["Checklist"],
    canAdvanceTo: ["Compliance Statement"]
  },
  "Compliance Statement": {
    doctype: "Compliance Statement",
    requiredState: "Finished",
    dependencies: ["Checklist", "Proposed Dispatch"],
    canAdvanceTo: ["Logistics"]
  }
};

/**
 * Resolve o nome do doctype a partir da configuração (pode ser string ou função)
 */
function resolveDoctypeName(form: FrappeForm, subWorkflowKey: string): string {
  const config = subWorkflow[subWorkflowKey];
  if (!config) throw new Error(`No configuration for: ${subWorkflowKey}`);
  
  return typeof config.doctype === 'function' ? config.doctype(form) : config.doctype;
}

/**
 * Valida se um doctype pode ser criado baseado no fluxo
 * Verifica diretamente no banco de dados se as dependências estão satisfeitas
 */
async function validateCreationFlow(
  form: FrappeForm,
  subWorkflowKey: string
): Promise<{ isValid: boolean; errorMessage?: string }> {
  const config = subWorkflow[subWorkflowKey];
  if (!config || !config.dependencies || config.dependencies.length === 0) {
    return { isValid: true };
  }

  // Regra especial para Proposed Dispatch: só exige Checklist se solution_select === 'Deep Analysis'
  if (subWorkflowKey === "Proposed Dispatch") {
    // Busca todos os Initial Analysis relacionados
    const initialAnalysisDocs = await frappe.db.get_list("Initial Analysis", {
      filters: {
        ticket_docname: form.doc.name
      },
      fields: ["name"]
    });
    let foundDeepAnalysis = false;
    if (initialAnalysisDocs.length > 0) {
      for (const doc of initialAnalysisDocs) {
        const docData = await frappe.db.get_value("Initial Analysis", doc.name, ["workflow_state", "solution_select"]);
        if (docData?.message?.workflow_state === "Finished") {
          if (docData?.message?.solution_select === "Deep Analysis") {
            foundDeepAnalysis = true;
            break;
          }
        }
      }
    }
    if (!foundDeepAnalysis) {
      // Não exige checklist se não for Deep Analysis
      return { isValid: true };
    }
    // Se for Deep Analysis, segue validação normal (Checklist precisa estar Finished)
  }

  // Validação padrão para outras etapas
  for (const depKey of config.dependencies) {
    const depConfig = subWorkflow[depKey];
    if (!depConfig) continue;

    const doctypeToCheck = resolveDoctypeName(form, depKey);

    const existingDocs = await frappe.db.get_list(doctypeToCheck, {
      filters: {
        ticket_docname: form.doc.name,
        workflow_state: depConfig.requiredState
      },
      fields: ['name'],
    });

    if (existingDocs && existingDocs.length > 0) {
      return { isValid: true };
    }
  }

  // Nenhuma dependência satisfeita
  const depNames = config.dependencies.map(d => resolveDoctypeName(form, d)).join(" or ");
  const targetDoctype = resolveDoctypeName(form, subWorkflowKey);

  return {
    isValid: false,
    errorMessage: `Cannot create ${targetDoctype}: ${depNames} must be in 'Finished' state first.`
  };
}

/**
 * Função universal para criar doctypes no sub-workflow
 * Gerencia todo o fluxo: validação, criação, atualização da tabela tracker e mudança de sub_workflow
 */
async function createSubWorkflowDoctype(
  form: FrappeForm,
  subWorkflowKey: string
): Promise<string | null> {
  if ((form as any)._subworkflow_creating) return null;
  (form as any)._subworkflow_creating = true;
  
  try {
    const config = subWorkflow[subWorkflowKey];
    if (!config) throw new Error(`No configuration for: ${subWorkflowKey}`);
    
    const doctypeName = resolveDoctypeName(form, subWorkflowKey);
    
    // Validação do fluxo
    if (!config.skipValidation) {
      const validation = await validateCreationFlow(form, subWorkflowKey);
      if (!validation.isValid) {
        console.warn(validation.errorMessage || `Cannot create ${doctypeName}.`);
        return null;
      }
    }
    
    // Verifica se já existe o doctype vinculado
    const existingDocs = await frappe.db.get_list(doctypeName, {
      filters: { ticket_docname: form.doc.name },
      fields: ['name'],
    });
    
    if (existingDocs && existingDocs.length > 0) {
      const existing_list_html = existingDocs.map(doc => `<li>${doc.name}</li>`).join("");
      console.warn(`Already exists a ${doctypeName} linked to this Ticket: <br><ul>${existing_list_html}</ul>`);
      
      // Atualiza o sub_workflow mesmo que já exista
      await form.set_value('sub_workflow', subWorkflowKey);
      form.doc['sub_workflow'] = subWorkflowKey;
      form.dirty();
      await form.save();
      
      return null;
    }
    
    // Prepara dados adicionais se houver função prepareData configurada
    let additionalData: Record<string, any> = { ticket_docname: "docname" };
    if (config.prepareData) {
      const preparedData = await config.prepareData(form);
      additionalData = { ...additionalData, ...preparedData };
    }
    
    // Cria o novo doctype com os dados preparados
    const docname = await agt.utils.doc.create_doc(doctypeName, additionalData, form.fields_dict);
    if (!docname) throw new Error(`Failed to create ${doctypeName}`);
    
    // Obtém o workflow_state do documento criado
    const doc = await frappe.db.get_value(doctypeName, docname, ['workflow_state']);
    const workflow_state = doc?.message?.workflow_state || 'Draft';
    
    // Adiciona na tabela tracker
    await agt.utils.table.row.add_one(form, "child_tracker_table", {
      child_tracker_docname: docname,
      child_tracker_doctype: doctypeName,
      child_tracker_workflow_state: workflow_state
    });
    
    // Atualiza o sub_workflow e salva
    await form.set_value('sub_workflow', subWorkflowKey);
    form.doc['sub_workflow'] = subWorkflowKey;
    form.dirty();
    await form.save();
    
    // Mensagem de sucesso
    frappe.show_alert({
      message: __(`${doctypeName} created successfully. Advanced to: ${subWorkflowKey}`),
      indicator: 'green'
    }, 5);
    
    return docname;
  } finally {
    (form as any)._subworkflow_creating = false;
  }
}

/**
 * Função universal para lidar com criação de qualquer doctype no subworkflow
 */
async function handleSubWorkflowStep(form: FrappeForm, subWorkflowKey: string) {
  try {
    await createSubWorkflowDoctype(form, subWorkflowKey);
  } catch (error) {
    console.error(`Error handling sub-workflow step ${subWorkflowKey}:`, error);
  }
}

/**
 * Função universal de recuperação de soft lock
 * Verifica se o sub_workflow está em uma etapa mas não há doctype vinculado
 */
async function recoverSubWorkflowSoftLock(form: FrappeForm, subWorkflowKey: string) {
  if (form.doc['sub_workflow'] !== subWorkflowKey) return;
  
  try {
    const doctypeName = resolveDoctypeName(form, subWorkflowKey);
    
    const existingDocs = await frappe.db.get_list(doctypeName, {
      filters: { ticket_docname: form.doc.name },
      fields: ['name'],
    });
    
    if (existingDocs && existingDocs.length > 0) return;
    
    console.warn(`⚠️ Soft lock detected: sub_workflow is in '${subWorkflowKey}' but there is no ${doctypeName} linked. Creating automatically...`);
    await handleSubWorkflowStep(form, subWorkflowKey);
  } catch (error) {
    console.error(`Error recovering soft lock for ${subWorkflowKey}:`, error);
  }
}

function moveFowardButton(form: FrappeForm) {
  if (!frappe.boot.user.roles.includes("System Manager")) return;

  const $button = cur_frm.add_custom_button(__("Avançar subetapa"), async () => {
    const current = form.doc['sub_workflow'];
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
      primary_action: async (values: any) => {
        const status = values.next_status;
        frappe.confirm(
          __("Confirming will advance to substep <b>" + status + "</b>. Do you want to proceed?"),
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

const orchestrator = {
  pre_actions: async function (form: FrappeForm) {
    if (!form.doc) return;
    const workflow_state = form.doc.workflow_state;
    const sub_workflow_value = form.doc['sub_workflow'];
    if (form.doc.__islocal || !form.doc.name || !form.doc.creation || typeof form.doc.creation !== "string" || form.doc.creation.length === 0) {
      return;
    }
    if (workflow_state != "Draft" && workflow_state != agt.metadata.doctype.ticket.workflow_state.active.name) {
      return;
    }

    // Tenta recuperar de soft lock antes de prosseguir (para todas as etapas configuradas)
    for (const subWorkflowKey of Object.keys(subWorkflow)) {
      await recoverSubWorkflowSoftLock(form, subWorkflowKey);
    }

    // Step 1: Creating 'Initial Analysis' if not exists
    if (sub_workflow_value !== "Initial Analysis" && (sub_workflow_value === "" || sub_workflow_value === null || sub_workflow_value === undefined)) {
      const validation = await validateCreationFlow(form, "Initial Analysis");
      if (validation.isValid) {
        await handleSubWorkflowStep(form, "Initial Analysis");
      }
    }
    // Step 2: Creating 'Checklist' if not exists and if criteria met
    if (sub_workflow_value === "Initial Analysis" && sub_workflow_value !== "Checklist") {
      const docs = (await frappe.db.get_list("Initial Analysis", {
        filters: {
          ticket_docname: form.doc.name
        },
        fields: ["name", "workflow_state", "solution_select"]
      })).filter(doc => doc.workflow_state === "Finished" && doc.solution_select === "Deep Analysis");
      if (docs && docs.length > 0) {
        await handleSubWorkflowStep(form, "Checklist");
      }
    }
    // Step 3: Creating 'Proposed Dispatch' if not exists and if criteria met
    if (
      (sub_workflow_value === "Initial Analysis" || sub_workflow_value === "Checklist") &&
      sub_workflow_value !== "Proposed Dispatch"
    ) {
      // Busca todos os Initial Analysis relacionados
      const initialAnalysisDocs = await frappe.db.get_list("Initial Analysis", {
        filters: {
          ticket_docname: form.doc.name
        },
        fields: ["name"]
      });

      // Busca checklist apenas se necessário
      let checklistFinished = false;
      const group = form.doc['main_eqp_group'];
      const checklistDoctype = checklistType[group];
      if (checklistDoctype) {
        const checklistDocs = await frappe.db.get_list(checklistDoctype, {
          filters: {
            ticket_docname: form.doc.name
          },
          fields: ["name"]
        });
        for (const doc of checklistDocs) {
          const docData = await frappe.db.get_value(checklistDoctype, doc.name, ["workflow_state"]);
          if (docData?.message?.workflow_state === "Finished") {
            checklistFinished = true;
            break;
          }
        }
      }

      let shouldCreateProposedDispatch = false;
      for (const doc of initialAnalysisDocs) {
        const docData = await frappe.db.get_value("Initial Analysis", doc.name, ["workflow_state", "solution_select"]);
        if (docData?.message?.workflow_state === "Finished") {
          // Caso 1: solution_select != 'Deep Analysis'
          if (docData?.message?.solution_select !== "Deep Analysis") {
            shouldCreateProposedDispatch = true;
            break;
          }
          // Caso 2: solution_select == 'Deep Analysis' e checklist finished
          if (docData?.message?.solution_select === "Deep Analysis" && checklistFinished) {
            shouldCreateProposedDispatch = true;
            break;
          }
        }
      }

      if (shouldCreateProposedDispatch) {
        await handleSubWorkflowStep(form, "Proposed Dispatch");
      }
    }
    // Step 4: Creating 'Compliance Statement' if not exists
    if ((sub_workflow_value === "Proposed Dispatch" || sub_workflow_value === "Checklist") && sub_workflow_value !== "Compliance Statement") {
      const validation = await validateCreationFlow(form, "Compliance Statement");
      if (validation.isValid) {
        await handleSubWorkflowStep(form, "Compliance Statement");
      }
    }
    moveFowardButton(form); // trigger move forward button
  }
};
export { orchestrator };

