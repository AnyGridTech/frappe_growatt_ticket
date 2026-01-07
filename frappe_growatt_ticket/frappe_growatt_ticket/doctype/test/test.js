frappe.ui.form.on('test', {
refresh(frm) {
const wrapper = frm.fields_dict.HTML_FIELD.$wrapper;
wrapper.empty();

    // 🟡 Show message if document is not saved yet
    if (frm.is_new()) {
        wrapper.html(`
            <div style="color: gray; margin-top: 10px;">
                ⚠️ Please save the document before uploading files.
            </div>
        `);
        return;
    }

    // 📁 Add the upload button inside the HTML field
    wrapper.html(`
        <div style="margin-top: 10px;">
            <button class="btn btn-primary" id="custom_upload_btn">
                📁 Upload Files
            </button>
            <div id="upload_status" style="margin-top: 8px; color: green;"></div>
        </div>
    `);

    // 🧠 Add click event to open Frappe FileUploader
    wrapper.find('#custom_upload_btn').on('click', function() {
        const uploader = new frappe.ui.FileUploader({
            doctype: frm.doctype,          // Link file to this DocType
            docname: frm.docname,          // Link file to this document
            folder: 'Home/Attachments',    // Save under this folder
            on_success(file_doc) {
                // ✅ File uploaded successfully
                frappe.show_alert({
                    message: __('File uploaded: ') + file_doc.file_name,
                    indicator: 'green'
                });

                // 📎 Add uploaded file to the form’s attachment list
                frm.attachments.add_attachment(file_doc);
                frm.attachments.refresh();

                // 🟢 Show success message below the button
                wrapper.find('#upload_status').text(`✅ ${file_doc.file_name} uploaded successfully`);
            }
        });
    });
}
});