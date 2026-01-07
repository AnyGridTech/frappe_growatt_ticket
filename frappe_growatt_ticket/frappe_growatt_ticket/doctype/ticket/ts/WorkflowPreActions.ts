// import type { Item, SerialNo, Ticket } from "@anygridtech/frappe-agt-types/agt/doctype";
import { FrappeForm } from "@anygridtech/frappe-types/client/frappe/core";
import { WorkflowPreActions } from "@anygridtech/frappe-agt-types/agt/client/workflow/";

const preActions = {
  // trigger_create_sn_into_db: async (frm: FrappeForm<Ticket> | FrappeForm<Record<string, any>>) => {
  //   try {
  //     // ============================================================
  //     // STEP 1: Get serial_no from Ticket
  //     // ============================================================
  //     const serial_no = frm.doc.main_eqp_serial_no;
  //     if (!serial_no || typeof serial_no !== 'string' || !serial_no.trim()) {
  //       throw new Error("Serial number not provided or invalid. Cannot proceed with Serial No creation.");
  //     }
  //     const db_sn = await frappe.db
  //       .get_value<SerialNo>('Serial No', serial_no, ['serial_no', 'item_code', 'warehouse', 'company', 'status', 'workflow_state'])
  //       .then(r => r?.message)
  //       .catch(e => {
  //         console.error("Error fetching Serial No:", e);
  //         throw new Error("Failed to query Serial No from database: " + (e instanceof Error ? e.message : String(e)));
  //       });

  //     // ============================================================
  //     // STEP 3: Get service_partner_company from Ticket
  //     // ============================================================
  //     const service_partner_company = frm.doc.service_partner_company;
  //     if (!service_partner_company || typeof service_partner_company !== 'string' || !service_partner_company.trim()) {
  //       throw new Error("Service partner company not defined. Cannot proceed with Serial No creation.");
  //     }

  //     // ============================================================
  //     // STEP 4: Validate if Serial No already exists with valid data
  //     // ============================================================
  //     // ⚠️ FIX: Check if serial_no AND item_code exist (not just if there are keys)
  //     const hasValidSerialNo = (sn: any): boolean => {
  //       return !!(sn?.serial_no && sn?.item_code);
  //     };

  //     if (hasValidSerialNo(db_sn)) {
  //       // Serial No already exists - just update workflow_state
  //       console.log(`Serial No '${db_sn!.serial_no}' already exists. Updating workflow state...`);
        
  //       await agt.utils.update_workflow_state({
  //         doctype: "Serial No",
  //         docname: db_sn!.serial_no,
  //         workflow_state: agt.metadata.doctype.initial_analysis.workflow_state.holding_action.name,
  //         ignore_workflow_validation: true
  //       });

  //       console.log(`✅ Serial No '${db_sn!.serial_no}' workflow state updated successfully.`);
  //     } else {
  //       // ============================================================
  //       // STEP 5: Serial No does not exist - create new record
  //       // ============================================================
  //       console.log(`Serial No '${serial_no}' does not exist. Creating new record...`);

  //       // Fetch Item details
  //       const item = await frappe.db
  //         .get_value<Item>('Item', { item_code: frm.doc['main_eqp_item_code'] }, ['item_name', 'item_code'])
  //         .then(r => r?.message)
  //         .catch(e => {
  //           console.error("Error fetching Item:", e);
  //           throw new Error("Failed to query Item from database: " + (e instanceof Error ? e.message : String(e)));
  //         });

  //       // ⚠️ FIX: More robust item validation
  //       if (!item || !item.item_code) {
  //         throw new Error(`Item not found or invalid for item code: ${frm.doc['main_eqp_item_code']}`);
  //       }

  //       // Prepare Serial No fields
  //       const serialNoFields: Record<string, any> = {
  //         serial_no: { value: serial_no },
  //         item_code: { value: item.item_code },
  //         company: { value: service_partner_company },
  //         status: { value: "Active" }
  //       };

  //       // Create new Serial No
  //       const sn_docname = await agt.utils.doc.create_doc<SerialNo>(
  //         'Serial No', 
  //         { docname: "ticket_docname" }, 
  //         serialNoFields
  //       );

  //       // ⚠️ FIX: Validate if creation returned a valid docname
  //       if (!sn_docname || typeof sn_docname !== 'string' || !sn_docname.trim()) {
  //         throw new Error("Failed to create Serial No - no valid document name returned.");
  //       }

  //       console.log(`✅ Serial No '${sn_docname}' created successfully.`);

  //       // Update workflow_state of new Serial No
  //       await agt.utils.update_workflow_state({
  //         doctype: "Serial No",
  //         docname: sn_docname,
  //         workflow_state: agt.metadata.doctype.initial_analysis.workflow_state.holding_action.name,
  //         ignore_workflow_validation: true
  //       });

  //       console.log(`✅ Serial No '${sn_docname}' workflow state set successfully.`);
  //     }
  //   } catch (error) {
  //     // ⚠️ FIX: Ensure errors are propagated correctly
  //     const errorMessage = error instanceof Error ? error.message : String(error);
  //     console.error("❌ Error in trigger_create_sn_into_db:", errorMessage);
      
  //     // Throw error to interrupt workflow
  //     throw new Error(`Serial No PreAction Failed: ${errorMessage}`);
  //   }
  // },

  orchestrator_redirect: async (frm: FrappeForm<Record<string, any>>) => {
    try {
      // Redirect to Ticket doctype, closing frappe_iframe iframe if necessary
      if (typeof window !== 'undefined') {
        const ticket_docname = frm?.doc['ticket_docname'];
        if (!ticket_docname) {
          console.warn("⚠️ ticket_docname not found. Skipping redirect.");
          return;
        }

        console.log(`🔄 Redirecting to Ticket: ${ticket_docname}`);

        // If inside an iframe (frappe_iframe), send message to parent
        if (window.self !== window.top) {
          window.parent.postMessage({
            action: 'frappe_iframe_close_and_redirect',
            target: `/app/ticket/${ticket_docname}`,
            docname: ticket_docname
          }, '*');
        } else {
          window.location.href = `/app/ticket/${ticket_docname}`;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Error in orchestrator_redirect:", errorMessage);
      // Does not throw error here as redirect is non-critical
    }
  }
};

// ============================================================
// ⚠️ CRITICAL FIX: Remove key duplication
// Now both actions are in the same object
// ============================================================
const wp: WorkflowPreActions = {
  [agt.metadata.doctype.initial_analysis.workflow_action.finish.name]: {
    // "Create Serial No.": preActions.trigger_create_sn_into_db,
    "Orchestrator Pre Actions": preActions.orchestrator_redirect
  }
};

frappe.ui.form.on('Ticket', 'before_load', async () => {
  if (!(globalThis as any).workflow_preactions) {
    (globalThis as any).workflow_preactions = {};
  }
  Object.assign((globalThis as any).workflow_preactions, wp);

});