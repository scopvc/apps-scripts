/**
 * @fileoverview Database Query Utility - Retrieve and summarize company data
 * 
 * This utility provides functions to query the company database and retrieve 
 * parsed company information for analysis and reporting.
 */

// === CONFIGURATION ===
// Database connection configuration will depend on chosen database
// For now, providing interface for common database operations

/**
 * Retrieve a single company record by ID
 * @param {string} companyId - Unique company identifier
 * @returns {object|null} Complete company record or null if not found
 */
function getCompanyById(companyId) {
  // TODO: Implement database query based on chosen database system
  // Example for different database types:
  
  // For Supabase:
  // const response = UrlFetchApp.fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
  //   headers: {
  //     'apikey': SUPABASE_API_KEY,
  //     'Authorization': `Bearer ${SUPABASE_API_KEY}`
  //   }
  // });
  
  // For Google Sheets as database:
  // const sheet = SpreadsheetApp.openById(DATABASE_SHEET_ID).getActiveSheet();
  // Find and return row data
  
  Logger.log(`Retrieving company with ID: ${companyId}`);
  throw new Error("Database connection not yet configured. Please implement database-specific query.");
}

/**
 * Retrieve company record by name
 * @param {string} companyName - Company name to search for
 * @returns {object|null} Company record or null if not found
 */
function getCompanyByName(companyName) {
  Logger.log(`Searching for company: ${companyName}`);
  throw new Error("Database connection not yet configured. Please implement database-specific query.");
}

/**
 * Retrieve all companies with filtering options
 * @param {object} filters - Optional filters for the query
 * @returns {Array<object>} Array of company records matching filters
 */
function getAllCompanies(filters = {}) {
  Logger.log(`Retrieving all companies with filters:`, filters);
  throw new Error("Database connection not yet configured. Please implement database-specific query.");
}

/**
 * Get companies within a specific ACV range
 * @param {number} minACV - Minimum ACV value
 * @param {number} maxACV - Maximum ACV value
 * @returns {Array<object>} Companies within ACV range
 */
function getCompaniesByACVRange(minACV, maxACV) {
  const filters = {
    acv_min: minACV,
    acv_max: maxACV
  };
  
  Logger.log(`Retrieving companies with ACV between $${minACV} and $${maxACV}`);
  return getAllCompanies(filters);
}

/**
 * Get companies by ARR range
 * @param {number} minARR - Minimum ARR value
 * @param {number} maxARR - Maximum ARR value
 * @returns {Array<object>} Companies within ARR range
 */
function getCompaniesByARRRange(minARR, maxARR) {
  const filters = {
    arr_min: minARR,
    arr_max: maxARR
  };
  
  Logger.log(`Retrieving companies with ARR between $${minARR} and $${maxARR}`);
  return getAllCompanies(filters);
}

/**
 * Get summary statistics for all companies in database
 * @returns {object} Summary statistics including counts, averages, etc.
 */
function getDatabaseSummary() {
  Logger.log("Generating database summary statistics");
  
  try {
    const allCompanies = getAllCompanies();
    
    if (!allCompanies || allCompanies.length === 0) {
      return {
        total_companies: 0,
        message: "No companies found in database"
      };
    }
    
    const summary = {
      total_companies: allCompanies.length,
      metrics: {
        avg_acv: calculateAverage(allCompanies, 'acv'),
        avg_arr: calculateAverage(allCompanies, 'arr_run_rate'),
        avg_team_size: calculateAverage(allCompanies, 'team_size'),
        avg_gross_margin: calculateAverage(allCompanies, 'gross_margin'),
        avg_nrr: calculateAverage(allCompanies, 'nrr'),
        avg_logo_churn: calculateAverage(allCompanies, 'logo_churn_annual')
      },
      segments: {
        with_complex_acv: allCompanies.filter(c => c.acv_2 !== null).length,
        with_complex_customers: allCompanies.filter(c => c.customer_count_2 !== null).length,
        with_carr: allCompanies.filter(c => c.carr !== null).length,
        with_valuation: allCompanies.filter(c => c.last_round_valuation !== null).length
      },
      date_range: {
        earliest: getEarliestDate(allCompanies),
        latest: getLatestDate(allCompanies)
      }
    };
    
    return summary;
    
  } catch (error) {
    Logger.log(`Error generating database summary: ${error.toString()}`);
    return {
      error: error.toString()
    };
  }
}

/**
 * Search companies by multiple criteria
 * @param {object} searchCriteria - Search parameters
 * @returns {Array<object>} Matching company records
 */
function searchCompanies(searchCriteria) {
  Logger.log("Searching companies with criteria:", searchCriteria);
  
  const {
    location,
    yearFoundedMin,
    yearFoundedMax,
    teamSizeMin,
    teamSizeMax,
    hasValuation,
    hasComplexACV
  } = searchCriteria;
  
  // Build filters object based on search criteria
  const filters = {};
  
  if (location) filters.location = location;
  if (yearFoundedMin) filters.year_founded_min = yearFoundedMin;
  if (yearFoundedMax) filters.year_founded_max = yearFoundedMax;
  if (teamSizeMin) filters.team_size_min = teamSizeMin;
  if (teamSizeMax) filters.team_size_max = teamSizeMax;
  if (hasValuation) filters.has_valuation = hasValuation;
  if (hasComplexACV) filters.has_complex_acv = hasComplexACV;
  
  return getAllCompanies(filters);
}

/**
 * Get companies that need data updates (missing key fields)
 * @returns {Array<object>} Companies with missing critical data
 */
function getCompaniesNeedingUpdates() {
  Logger.log("Finding companies that need data updates");
  
  try {
    const allCompanies = getAllCompanies();
    
    const needingUpdates = allCompanies.filter(company => {
      // Define critical fields that should be present
      const criticalFields = [
        'arr_run_rate', 'acv', 'customer_count', 'team_size', 
        'monthly_burn', 'cash', 'gross_margin'
      ];
      
      const missingFields = criticalFields.filter(field => 
        company[field] === null || company[field] === undefined
      );
      
      return missingFields.length > 0;
    });
    
    return needingUpdates.map(company => ({
      id: company.id,
      company_name: company.company_name,
      doc_url: company.doc_url,
      missing_fields: getCriticalMissingFields(company)
    }));
    
  } catch (error) {
    Logger.log(`Error finding companies needing updates: ${error.toString()}`);
    return [];
  }
}

// === HELPER FUNCTIONS ===

/**
 * Calculate average for a specific field across companies
 * @param {Array<object>} companies - Array of company records
 * @param {string} field - Field name to calculate average for
 * @returns {number|null} Average value or null if no valid data
 */
function calculateAverage(companies, field) {
  const validValues = companies
    .map(company => company[field])
    .filter(value => value !== null && value !== undefined && !isNaN(value));
  
  if (validValues.length === 0) return null;
  
  const sum = validValues.reduce((acc, val) => acc + val, 0);
  return sum / validValues.length;
}

/**
 * Get earliest date from company records
 * @param {Array<object>} companies - Array of company records
 * @returns {string|null} Earliest date or null
 */
function getEarliestDate(companies) {
  const dates = companies
    .map(c => c.date_created)
    .filter(date => date !== null && date !== undefined)
    .map(date => new Date(date));
  
  if (dates.length === 0) return null;
  return new Date(Math.min(...dates)).toISOString();
}

/**
 * Get latest date from company records
 * @param {Array<object>} companies - Array of company records
 * @returns {string|null} Latest date or null
 */
function getLatestDate(companies) {
  const dates = companies
    .map(c => c.date_created)
    .filter(date => date !== null && date !== undefined)
    .map(date => new Date(date));
  
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates)).toISOString();
}

/**
 * Get list of critical missing fields for a company
 * @param {object} company - Company record
 * @returns {Array<string>} Array of missing field names
 */
function getCriticalMissingFields(company) {
  const criticalFields = [
    'arr_run_rate', 'acv', 'customer_count', 'team_size',
    'monthly_burn', 'cash', 'gross_margin', 'location', 'description'
  ];
  
  return criticalFields.filter(field => 
    company[field] === null || company[field] === undefined
  );
}

// === TEST FUNCTIONS ===

/**
 * Test function to demonstrate database query capabilities
 */
function testDatabaseQueries() {
  Logger.log("=== Testing Database Query Functions ===");
  
  try {
    // Test summary generation
    Logger.log("Testing database summary...");
    const summary = getDatabaseSummary();
    Logger.log("Database Summary:", summary);
    
    // Test company search
    Logger.log("Testing company search...");
    const searchResults = searchCompanies({
      teamSizeMin: 10,
      teamSizeMax: 100,
      hasValuation: true
    });
    Logger.log(`Found ${searchResults.length} companies matching criteria`);
    
    // Test companies needing updates
    Logger.log("Testing companies needing updates...");
    const needingUpdates = getCompaniesNeedingUpdates();
    Logger.log(`Found ${needingUpdates.length} companies needing updates`);
    
    Logger.log("=== Database Query Tests Complete ===");
    
  } catch (error) {
    Logger.log(`Test failed: ${error.toString()}`);
  }
}
