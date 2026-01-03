import { WorkflowValidation } from "@anygridtech/frappe-agt-types/agt/client/workflow/before_workflow_action";

const workflow_validations: WorkflowValidation[] = [
  {
    workflow_state: "Rascunho",
    workflow_action: "Solicitar Análise",
    action_extended: ["SAVE", "LOAD"],
    workflow_fields: [
      {
        name: "main_customer_email",
        depends_on: (frm) => {
          const email = frm.doc.main_customer_email;
          if (!email || email.trim() === "") {
            return `O campo ${frm.fields_dict["main_customer_email"]?.df?.label ?? "main_customer_email"} deve estar preenchido.`;
          }
          return undefined;
        }
      },
      {
        name: "main_eqp_serial_no",
        depends_on: (frm) => {
          const serial_no = frm.doc.main_eqp_serial_no;
          if (!serial_no || serial_no.trim() === "") {
            return `O campo ${frm.fields_dict["main_eqp_serial_no"]?.df?.label ?? "main_eqp_serial_no"} deve estar preenchido.`;
          }
          return undefined;
        }
      },
      {
        name: "main_eqp_model_ref",
        depends_on: (frm) => {
          const model_ref = frm.doc.main_eqp_model_ref;
          if (!model_ref || model_ref.trim() === "") {
            return `O campo ${frm.fields_dict["main_eqp_model_ref"]?.df?.label ?? "main_eqp_model_ref"} deve estar preenchido.`;
          }
          return undefined;
        }
      },
    ]
  },
];

if (!(globalThis as any).workflow_validations) {
  (globalThis as any).workflow_validations = [];
}

(globalThis as any).workflow_validations.push(...workflow_validations);