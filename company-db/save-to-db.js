/**
 * @fileoverview Database Write Utility - Save parsed company data to external database
 * 
 * This utility handles saving normalized company records to the external database,
 * with support for different database backends and proper error handling.
 */

// === CONFIGURATION ===
// Database configuration - to be set based on chosen database system

// Example configurations for different databases:
// const SUPABASE_URL = PropertiesService.getScriptProperties().getProperty("SUPABASE_URL");
// const SUPABASE_API_KEY = PropertiesService.getScriptProperties().getProperty("SUPABASE_API_KEY");
// const DATABASE_SHEET_ID = PropertiesService.getScriptProperties().getProperty("DATABASE_SHEET_ID");

/**
 * Save a company record to the database
 * @param {object} companyRecord - Complete normalized company record
 * @returns {object} Result object with success status and details
 */
function saveCompanyToDatabase(companyRecord) {
  Logger.log(`Saving company to database: ${companyRecord.company_name}`);
  
  try {
    // Validate the company record before saving
    const validationResult = validateCompanyRecord(companyRecord);
    if (!validationResult.isValid) {
      Logger.log(`Validation failed: ${validationResult.errors.join(', ')}`);
      return {
        success: false,
        error: "Validation failed",
        details: validationResult.errors
      };
    }
    
    // Check if company already exists
    const existingCompany = findExistingCompany(companyRecord);
    if (existingCompany) {
      Logger.log(`Company already exists with ID: ${existingCompany.id}`);
      return updateExistingCompany(existingCompany.id, companyRecord);
    }
    
    // Save new company record
    const saveResult = insertNewCompany(companyRecord);
    Logger.log(`Company saved successfully with ID: ${saveResult.id}`);
    
    return {
      success: true,
      id: saveResult.id,
      action: "created",
      company_name: companyRecord.company_name
    };
    
  } catch (error) {
    Logger.log(`Error saving company to database: ${error.toString()}`);
    return {
      success: false,
      error: error.toString(),
      company_name: companyRecord.company_name
    };
  }
}

/**
 * Batch save multiple company records
 * @param {Array<object>} companyRecords - Array of company records to save
 * @returns {object} Batch save results with success/failure counts
 */
function batchSaveCompanies(companyRecords) {
  Logger.log(`Starting batch save of ${companyRecords.length} companies`);
  
  const results = {
    total: companyRecords.length,
    successful: 0,
    failed: 0,
    details: []
  };
  
  companyRecords.forEach((record, index) => {
    try {
      const saveResult = saveCompanyToDatabase(record);
      
      if (saveResult.success) {
        results.successful++;
      } else {
        results.failed++;
      }
      
      results.details.push({
        index: index,
        company_name: record.company_name,
        success: saveResult.success,
        error: saveResult.error || null,
        id: saveResult.id || null
      });
      
    } catch (error) {
      results.failed++;
      results.details.push({
        index: index,
        company_name: record.company_name,
        success: false,
        error: error.toString()
      });
    }
    
    // Log progress for large batches
    if ((index + 1) % 10 === 0) {
      Logger.log(`Processed ${index + 1}/${companyRecords.length} companies`);
    }
  });
  
  Logger.log(`Batch save complete: ${results.successful} successful, ${results.failed} failed`);
  return results;
}

/**
 * Update an existing company record
 * @param {string} companyId - Existing company ID
 * @param {object} updatedRecord - Updated company data
 * @returns {object} Update result
 */
function updateExistingCompany(companyId, updatedRecord) {
  Logger.log(`Updating existing company: ${companyId}`);
  
  try {
    // Add update timestamp
    const recordWithTimestamp = {
      ...updatedRecord,
      date_updated: new Date().toISOString()
    };
    
    // Perform database update based on chosen database system
    const updateResult = performDatabaseUpdate(companyId, recordWithTimestamp);
    
    return {
      success: true,
      id: companyId,
      action: "updated",
      company_name: updatedRecord.company_name
    };
    
  } catch (error) {
    Logger.log(`Error updating company ${companyId}: ${error.toString()}`);
    return {
      success: false,
      error: error.toString(),
      company_name: updatedRecord.company_name
    };
  }
}

/**
 * Delete a company record from the database
 * @param {string} companyId - Company ID to delete
 * @returns {object} Deletion result
 */
function deleteCompanyFromDatabase(companyId) {
  Logger.log(`Deleting company from database: ${companyId}`);
  
  try {
    const deleteResult = performDatabaseDelete(companyId);
    
    return {
      success: true,
      id: companyId,
      action: "deleted"
    };
    
  } catch (error) {
    Logger.log(`Error deleting company ${companyId}: ${error.toString()}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// === DATABASE-SPECIFIC OPERATIONS ===

/**
 * Insert new company record into database
 * @param {object} companyRecord - Company record to insert
 * @returns {object} Insert result with new ID
 */
function insertNewCompany(companyRecord) {
  // TODO: Implement based on chosen database system
  
  // Example for Supabase:
  /*
  const response = UrlFetchApp.fetch(`${SUPABASE_URL}/rest/v1/companies`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_API_KEY,
      'Authorization': `Bearer ${SUPABASE_API_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    payload: JSON.stringify(companyRecord)
  });
  
  if (response.getResponseCode() !== 201) {
    throw new Error(`Database insert failed: ${response.getContentText()}`);
  }
  
  const result = JSON.parse(response.getContentText());
  return { id: result[0].id };
  */
  
  // Example for Google Sheets:
  /*
  const sheet = SpreadsheetApp.openById(DATABASE_SHEET_ID).getActiveSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const values = headers.map(header => companyRecord[header] || '');
  sheet.appendRow(values);
  return { id: companyRecord.id };
  */
  
  Logger.log("Database insert operation - implementation needed");
  throw new Error("Database connection not yet configured. Please implement database-specific insert.");
}

/**
 * Update existing company record in database
 * @param {string} companyId - Company ID to update
 * @param {object} updatedRecord - Updated record data
 * @returns {object} Update result
 */
function performDatabaseUpdate(companyId, updatedRecord) {
  // TODO: Implement based on chosen database system
  
  // Example for Supabase:
  /*
  const response = UrlFetchApp.fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_API_KEY,
      'Authorization': `Bearer ${SUPABASE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(updatedRecord)
  });
  
  if (response.getResponseCode() !== 204) {
    throw new Error(`Database update failed: ${response.getContentText()}`);
  }
  */
  
  Logger.log("Database update operation - implementation needed");
  throw new Error("Database connection not yet configured. Please implement database-specific update.");
}

/**
 * Delete company record from database
 * @param {string} companyId - Company ID to delete
 * @returns {object} Delete result
 */
function performDatabaseDelete(companyId) {
  // TODO: Implement based on chosen database system
  
  Logger.log("Database delete operation - implementation needed");
  throw new Error("Database connection not yet configured. Please implement database-specific delete.");
}

/**
 * Find existing company by name or doc URL to avoid duplicates
 * @param {object} companyRecord - Company record to check
 * @returns {object|null} Existing company record or null
 */
function findExistingCompany(companyRecord) {
  try {
    // TODO: Implement database query to find existing company
    // Check by company name and/or doc URL
    
    Logger.log("Checking for existing company - implementation needed");
    return null; // No duplicates found (placeholder)
    
  } catch (error) {
    Logger.log(`Error checking for existing company: ${error.toString()}`);
    return null;
  }
}

// === VALIDATION FUNCTIONS ===

/**
 * Validate company record before saving to database
 * @param {object} companyRecord - Company record to validate
 * @returns {object} Validation result with isValid flag and errors array
 */
function validateCompanyRecord(companyRecord) {
  const errors = [];
  
  // Required fields validation
  const requiredFields = ['id', 'company_name', 'doc_url', 'date_created'];
  requiredFields.forEach(field => {
    if (!companyRecord[field] || companyRecord[field].toString().trim() === '') {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Data type validation
  const numericFields = [
    'arr_run_rate', 'carr', 'revenue_2024', 'revenue_2023', 'revenue_2022',
    'monthly_burn', 'cash', 'runway', 'raising', 'raised', 'last_round_valuation',
    'acv', 'acv_2', 'customer_count', 'customer_count_2', 'logo_churn_annual',
    'cac', 'payback_period', 'ltv_to_cac', 'gross_margin', 'saas_recurring_percent', 'nrr'
  ];
  
  numericFields.forEach(field => {
    const value = companyRecord[field];
    if (value !== null && value !== undefined && (isNaN(value) || typeof value !== 'number')) {
      errors.push(`Invalid numeric value for field: ${field}`);
    }
  });
  
  // Range validation for percentage fields
  const percentageFields = ['gross_margin', 'saas_recurring_percent', 'logo_churn_annual'];
  percentageFields.forEach(field => {
    const value = companyRecord[field];
    if (value !== null && value !== undefined && (value < 0 || value > 5)) {
      errors.push(`Invalid percentage value for field ${field}: must be between 0 and 5 (as decimal)`);
    }
  });
  
  // Integer field validation
  const integerFields = ['team_size', 'year_founded', 'customer_count', 'customer_count_2'];
  integerFields.forEach(field => {
    const value = companyRecord[field];
    if (value !== null && value !== undefined && !Number.isInteger(value)) {
      errors.push(`Invalid integer value for field: ${field}`);
    }
  });
  
  // Year founded validation
  if (companyRecord.year_founded !== null && companyRecord.year_founded !== undefined) {
    const currentYear = new Date().getFullYear();
    if (companyRecord.year_founded < 1800 || companyRecord.year_founded > currentYear) {
      errors.push(`Invalid year_founded: must be between 1800 and ${currentYear}`);
    }
  }
  
  // Complex field consistency validation
  if (companyRecord.acv_2 !== null && companyRecord.acv === null) {
    errors.push("Invalid ACV data: acv_2 exists but primary acv is null");
  }
  
  if (companyRecord.customer_count_2 !== null && companyRecord.customer_count === null) {
    errors.push("Invalid customer count data: customer_count_2 exists but primary customer_count is null");
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Sanitize company record data before database insertion
 * @param {object} companyRecord - Raw company record
 * @returns {object} Sanitized company record
 */
function sanitizeCompanyRecord(companyRecord) {
  const sanitized = { ...companyRecord };
  
  // Trim string fields
  const stringFields = ['company_name', 'location', 'description', 'competition', 
                       'revenue_notes', 'funding_notes', 'good', 'challenges', 'needs_action'];
  
  stringFields.forEach(field => {
    if (sanitized[field] && typeof sanitized[field] === 'string') {
      sanitized[field] = sanitized[field].trim();
      // Convert empty strings to null
      if (sanitized[field] === '') {
        sanitized[field] = null;
      }
    }
  });
  
  // Ensure numeric fields are properly typed
  const numericFields = ['arr_run_rate', 'carr', 'revenue_2024', 'revenue_2023', 'revenue_2022',
                        'monthly_burn', 'cash', 'runway', 'raising', 'raised', 'last_round_valuation',
                        'acv', 'acv_2', 'logo_churn_annual', 'cac', 'payback_period', 'ltv_to_cac',
                        'gross_margin', 'saas_recurring_percent', 'nrr'];
  
  numericFields.forEach(field => {
    if (sanitized[field] !== null && sanitized[field] !== undefined) {
      sanitized[field] = Number(sanitized[field]);
    }
  });
  
  // Ensure integer fields are integers
  const integerFields = ['team_size', 'year_founded', 'customer_count', 'customer_count_2'];
  integerFields.forEach(field => {
    if (sanitized[field] !== null && sanitized[field] !== undefined) {
      sanitized[field] = Math.round(Number(sanitized[field]));
    }
  });
  
  return sanitized;
}

// === INTEGRATION FUNCTIONS ===

/**
 * Complete workflow: Parse and save company from Google Doc
 * @param {string} docId - Google Doc ID to parse and save
 * @returns {object} Complete operation result
 */
function parseAndSaveCompany(docId) {
  Logger.log(`Starting parse and save workflow for doc: ${docId}`);
  
  try {
    // Parse company data from Google Doc
    const parsedData = parseCompanyFromDoc(docId); // From parse-company.js
    
    // Sanitize the parsed data
    const sanitizedData = sanitizeCompanyRecord(parsedData);
    
    // Save to database
    const saveResult = saveCompanyToDatabase(sanitizedData);
    
    return {
      success: saveResult.success,
      operation: "parse_and_save",
      doc_id: docId,
      company_name: parsedData.company_name,
      database_result: saveResult
    };
    
  } catch (error) {
    Logger.log(`Error in parse and save workflow: ${error.toString()}`);
    return {
      success: false,
      operation: "parse_and_save",
      doc_id: docId,
      error: error.toString()
    };
  }
}

/**
 * Batch process multiple Google Docs
 * @param {Array<string>} docIds - Array of Google Doc IDs to process
 * @returns {object} Batch processing results
 */
function batchParseAndSave(docIds) {
  Logger.log(`Starting batch parse and save for ${docIds.length} documents`);
  
  const results = {
    total: docIds.length,
    successful: 0,
    failed: 0,
    details: []
  };
  
  docIds.forEach((docId, index) => {
    const result = parseAndSaveCompany(docId);
    
    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
    }
    
    results.details.push(result);
    
    // Progress logging
    if ((index + 1) % 5 === 0) {
      Logger.log(`Processed ${index + 1}/${docIds.length} documents`);
    }
  });
  
  Logger.log(`Batch processing complete: ${results.successful} successful, ${results.failed} failed`);
  return results;
}

// === TEST FUNCTIONS ===

/**
 * Test database save functionality
 */
function testDatabaseSave() {
  Logger.log("=== Testing Database Save Functions ===");
  
  // Create a test company record
  const testCompany = {
    id: Utilities.getUuid(),
    company_name: "Test Company Inc",
    doc_url: "https://docs.google.com/document/d/test123",
    date_created: new Date().toISOString(),
    arr_run_rate: 1000000,
    acv: 50000,
    customer_count: 20,
    team_size: 25,
    year_founded: 2020,
    location: "San Francisco, CA",
    description: "Test company for database validation",
    monthly_burn: 100000,
    cash: 2000000,
    gross_margin: 0.8,
    // All other fields null for testing
    carr: null,
    revenue_2024: null,
    revenue_2023: null,
    revenue_2022: null,
    runway: null,
    raising: null,
    raised: null,
    last_round_valuation: null,
    acv_2: null,
    customer_count_2: null,
    logo_churn_annual: null,
    cac: null,
    payback_period: null,
    ltv_to_cac: null,
    saas_recurring_percent: null,
    nrr: null,
    competition: null,
    revenue_notes: null,
    funding_notes: null,
    good: null,
    challenges: null,
    needs_action: null
  };
  
  try {
    // Test validation
    Logger.log("Testing record validation...");
    const validationResult = validateCompanyRecord(testCompany);
    Logger.log(`Validation result: ${validationResult.isValid ? 'PASSED' : 'FAILED'}`);
    if (!validationResult.isValid) {
      Logger.log(`Validation errors: ${validationResult.errors.join(', ')}`);
    }
    
    // Test sanitization
    Logger.log("Testing record sanitization...");
    const sanitizedRecord = sanitizeCompanyRecord(testCompany);
    Logger.log("Sanitization completed");
    
    // Test save (will fail without database connection, but tests the flow)
    Logger.log("Testing database save...");
    try {
      const saveResult = saveCompanyToDatabase(sanitizedRecord);
      Logger.log(`Save result: ${JSON.stringify(saveResult)}`);
    } catch (error) {
      Logger.log(`Expected error (no database configured): ${error.toString()}`);
    }
    
    Logger.log("=== Database Save Tests Complete ===");
    
  } catch (error) {
    Logger.log(`Test failed: ${error.toString()}`);
  }
}
