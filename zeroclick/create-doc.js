/**
 * @fileoverview This script contains functionality to create a new Google Document
 * with pre-filled company information, which serves as a note-taking template.
 */

/**
 * Creates a Google Doc with details about a company and saves it to a specified Drive folder.
 *
 * @param {object} companyInfo - An object containing the company's details, such as name, website, etc.
 * @returns {string} The URL of the newly created Google Doc.
 */
function createCompanyNoteDoc(companyInfo) {
  // --- Configuration ---
  // The ID of the Google Drive folder where the new document will be saved.
  // To find the folder ID, open the folder in your browser; the ID is the last part of the URL.
  const folderId = "1YPrT-_fLgPk4V5LSffNqo5O0grJ6Olnl";
  const folder = DriveApp.getFolderById(folderId);

  // --- Document Creation ---
  const rawdate = new Date();
  const date = Utilities.formatDate(rawdate, Session.getScriptTimeZone(), "M/d/yyyy");

  const docTitle = `${companyInfo.name} ${date}`;
  const doc = DocumentApp.create(docTitle);
  const body = doc.getBody();

  // --- Document Content Template ---
  // This array defines the structure of the document, with each inner array
  // representing a line with a label and a pre-filled value from companyInfo.
  const fields = [
    ["Company Name:", companyInfo.name || ""],
    ["Date:", new Date().toLocaleDateString()],
    ["Members:", `James <> ${companyInfo.counterpartName || ""}`],
    ["URL:", companyInfo.website || ""],
    ["", ""],
    ["Link to deck:", ""],
    ["Link to data room:", ""],
    ["Description:", companyInfo.description || ""],
    ["Crunchbase:", ""],
    ["Linkedin:", companyInfo.linkedin || ""],
    ["Source:", ""],
    ["Location:", companyInfo.location || ""],
    ["Remote or All in person:", ""],
    ["Year founded:", companyInfo.yearFounded || ""],
    ["Team size:", ""],
    ["ARR Run Rate:", "$"],
    ["2024 rev:", ""],
    ["2023 rev:", ""],
    ["2022 rev:", ""],
    ["Revenue Notes:", ""],
    ["% SaaS Recurring:", ""],
    ["Gross Margin:", ""],
    ["# of Customers:", ""],
    ["Customer Notes:", ""],
    ["Competition:", ""],
    ["ACV:", "$"],
    ["Logo Churn Annual:", ""],
    ["Net Revenue Retention:", ""],
    ["Blended CAC:", "$"],
    ["Payback Period:", ""],
    ["Monthly Burn:", "$"],
    ["Cash:", "$"],
    ["Runway:", ""],
    ["Raising:", "$"],
    ["Raised:", "$"],
    ["Active round / fundraise Notes:", ""],
    ["Other Funding Notes:", ""],
    ["", ""],
    ["Good:", ""],
    ["", ""],
    ["Challenges:", ""],
    ["", ""],
    ["Needs Action:", ""],
    ["", ""],
  ];

  // --- Populate Document ---
  // Loop through the fields array to build the document body.
  fields.forEach(([label, value]) => {
    const paragraph = body.appendParagraph('');
    const text = paragraph.editAsText();

    let cursor = 0;

    // Append the label in bold.
    if (label && label.length > 0) {
      text.appendText(label);
      text.setBold(cursor, cursor + label.length - 1, true);
      cursor += label.length;
    }

    // Append the corresponding value in normal text.
    if (value && value.length > 0) {
      text.appendText(' ' + value);
      text.setBold(cursor + 1, cursor + value.length, false); // +1 for space
    }
  });

  // --- Finalization ---
  doc.saveAndClose();

  // Move the newly created document to the specified folder.
  const file = DriveApp.getFileById(doc.getId());
  file.moveTo(folder);

  Logger.log(`Created doc in folder: ${docTitle}`);
  return doc.getUrl();
}
