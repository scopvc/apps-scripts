 /**
 * @fileoverview Main script to orchestrate the batch processing of company documents.
 * Iterates through a folder structure, parses company data from Google Docs,
 * and saves the structured data to a Google Sheet.
 */

// === CONFIGURATION ===
// IMPORTANT: Set this Script Property to the ID of your master Google Drive folder.
// This folder should contain subfolders for each company.
const MASTER_FOLDER_ID = PropertiesService.getScriptProperties().getProperty("MASTER_FOLDER_ID");

/**
 * Main function to process all company documents within the master folder.
 * It iterates through each subfolder, finds all Google Docs, runs the parsing
 * function on each, and then saves the result to the configured Google Sheet.
 */
function processAllCompaniesInMasterFolder() {
  if (!MASTER_FOLDER_ID) {
    throw new Error("MASTER_FOLDER_ID is not set in Script Properties. Please configure the ID of the master Google Drive folder.");
  }
  
  const masterFolder = DriveApp.getFolderById(MASTER_FOLDER_ID);
  const subfolders = masterFolder.getFolders();
  
  let processedCount = 0;
  let errorCount = 0;
  
  Logger.log(`Starting company processing for master folder: ${masterFolder.getName()}`);

  while (subfolders.hasNext()) {
    const folder = subfolders.next();
    Logger.log(`Scanning subfolder: ${folder.getName()}`);
    
    const files = folder.getFilesByType(MimeType.GOOGLE_DOCS);
    
    while (files.hasNext()) {
      const file = files.next();
      const docId = file.getId();
      Logger.log(`-- Found document: ${file.getName()} (ID: ${docId})`);
      
      try {
        // Step 1: Parse the company data from the document
        const companyRecord = parseCompanyFromDoc(docId);
        
        // Ensure a valid record was returned before saving
        if (companyRecord && companyRecord.company_name) {
          // Step 2: Save the structured record to the Google Sheet
          saveCompanyRecord(companyRecord);
          processedCount++;
        } else {
          Logger.log(`---- Skipping file, parsing did not return a valid company record for: ${file.getName()}`);
        }
      } catch (e) {
        Logger.log(`---- ERROR processing document ${file.getName()}: ${e.toString()}`);
        errorCount++;
        // Continue to the next file
      }
    }
  }
  
  Logger.log("========================================");
  Logger.log("Batch processing complete.");
  Logger.log(`Successfully processed files: ${processedCount}`);
  Logger.log(`Failed files: ${errorCount}`);
  Logger.log("========================================");
}
