/**
 * @fileoverview Functions to save normalized company data to a Google Sheet database.
 */

// === CONFIGURATION ===
// IMPORTANT: Set this Script Property to your Google Sheet ID
// Go to File > Project Properties > Script Properties
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
const SHEET_NAME = "Companies";

// === MAIN SAVE FUNCTION ===

/**
 * Saves a single, structured company record to the Google Sheet database.
 * This function is idempotent: if a record with the same `id` exists, it updates it.
 * Otherwise, it appends a new row.
 *
 * @param {object} companyRecord - A structured object containing normalized company data.
 */
function saveCompanyRecord(companyRecord) {
  if (!SPREADSHEET_ID) {
    throw new Error("SPREADSHEET_ID is not set in Script Properties. Please configure the target Google Sheet ID.");
  }
  
  try {
    const sheet = getOrCreateSheet(SPREADSHEET_ID, SHEET_NAME);
    const headers = getHeaders(sheet);
    
    // Ensure headers are present
    if (headers.length === 0) {
      const recordHeaders = Object.keys(companyRecord);
      setHeaders(sheet, recordHeaders);
      headers = recordHeaders;
    }
    
    // Convert record object to an array in the correct order
    const newRow = headers.map(header => companyRecord[header] !== undefined ? companyRecord[header] : null);
    
    // Check for existing record by ID to update, otherwise append
    const idColumnIndex = headers.indexOf('id') + 1;
    if (idColumnIndex > 0) {
      const idColumnValues = sheet.getRange(2, idColumnIndex, sheet.getLastRow(), 1).getValues().flat();
      const existingRowIndex = idColumnValues.indexOf(companyRecord.id) + 2; // +2 for 1-based index and header row
      
      if (existingRowIndex > 1) {
        // Update existing row
        Logger.log(`Updating existing record for company: ${companyRecord.company_name} (ID: ${companyRecord.id})`);
        sheet.getRange(existingRowIndex, 1, 1, newRow.length).setValues([newRow]);
      } else {
        // Append new row
        Logger.log(`Appending new record for company: ${companyRecord.company_name} (ID: ${companyRecord.id})`);
        sheet.appendRow(newRow);
      }
    } else {
      // Fallback to just appending if no 'id' column is found
      Logger.log(`Appending new record (no ID column found) for company: ${companyRecord.company_name}`);
      sheet.appendRow(newRow);
    }

    Logger.log(`Successfully saved record for: ${companyRecord.company_name}`);
    
  } catch (error) {
    Logger.log(`Error saving company record: ${error.toString()}`);
    throw error;
  }
}


// === SHEET UTILITY FUNCTIONS ===

/**
 * Gets or creates the target sheet within the specified spreadsheet.
 * @param {string} spreadsheetId - The ID of the Google Spreadsheet.
 * @param {string} sheetName - The name of the sheet to get or create.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} The sheet object.
 */
function getOrCreateSheet(spreadsheetId, sheetName) {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    Logger.log(`Created new sheet: "${sheetName}"`);
  }
  
  return sheet;
}

/**
 * Retrieves the header row from a sheet.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet object.
 * @returns {string[]} An array of header values.
 */
function getHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    return [];
  }
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  return headerRange.getValues()[0];
}

/**
 * Writes the header row to a sheet.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet object.
 * @param {string[]} headers - An array of header values to set.
 */
function setHeaders(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  Logger.log("Set sheet headers and froze first row.");
}


