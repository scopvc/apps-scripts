/**
 * @fileoverview Company Data Parser - Extract and normalize company metrics from Google Docs
 * 
 * This system parses VC due diligence notes from Google Docs into clean, structured database records.
 * Uses OpenAI responses API with strict JSON schemas for reliable data extraction.
 * 
 * Architecture:
 * - Extract raw field data from Google Doc
 * - Batch process simple fields with standard normalization  
 * - Individually analyze complex fields with high complexity filter
 * - Process special fields with custom rules
 * - Assemble complete normalized record
 */

// === CONFIGURATION ===
const OPENAI_API_KEY = PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY");
const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-4o";

// === MAIN ENTRY POINT ===

/**
 * Main function to parse company data from a Google Doc
 * @param {string} docId - Google Doc ID containing company notes
 * @returns {object} Complete normalized company record
 */
function parseCompanyFromDoc(docId) {
  try {
    Logger.log(`Starting parse for document: ${docId}`);
    
    // Stage 1: Extract raw field values from Google Doc
    const rawFields = extractRawFieldsFromDoc(docId);
    Logger.log(`Extracted ${Object.keys(rawFields).length} raw fields`);
    
    // Stage 2: Process simple fields in single batch
    const simpleFields = parseSimpleFieldsBatch(rawFields);
    Logger.log(`Processed simple fields batch`);
    
    // Stage 3: Analyze complex fields individually with full context
    const acvData = analyzeACVComplexity(rawFields['ACV'] || '', {
      revenue_notes: rawFields['Revenue Notes'] || '',
      arr_run_rate: rawFields['ARR Run Rate'] || '',
      customer_count: rawFields['# of Customers'] || ''
    });
    const customerData = analyzeCustomerComplexity(rawFields['# of Customers'] || '', {
      customer_notes: rawFields['Customer Notes'] || '',
      acv: rawFields['ACV'] || '',
      revenue_notes: rawFields['Revenue Notes'] || ''
    });
    const churnData = convertChurnToAnnual(rawFields['Logo Churn Annual'] || '');
    Logger.log(`Analyzed complex fields`);
    
    // Stage 4: Process special fields
    const burnData = normalizeMonthlyBurn(rawFields['Monthly Burn'] || '');
    const valuationData = extractLastRoundValuation(
      (rawFields['Active round / fundraise Notes'] || '') + ' ' + 
      (rawFields['Other Funding Notes'] || ''),
      {
        raised: rawFields['Raised'] || '',
        raising: rawFields['Raising'] || ''
      }
    );
    Logger.log(`Processed special fields`);
    
    // Stage 5: Assemble complete record
    const completeRecord = assembleCompleteRecord(
      docId, rawFields, simpleFields, acvData, customerData, 
      churnData, burnData, valuationData
    );
    
    Logger.log(`Successfully parsed company: ${completeRecord.company_name}`);
    return completeRecord;
    
  } catch (error) {
    Logger.log(`Error parsing company from doc ${docId}: ${error.toString()}`);
    throw error;
  }
}

// === GOOGLE DOC EXTRACTION ===

/**
 * Extract raw field values from Google Doc
 * @param {string} docId - Google Doc ID
 * @returns {object} Map of field labels to raw text values
 */
function extractRawFieldsFromDoc(docId) {
  try {
    const doc = DocumentApp.openById(docId);
    const body = doc.getBody();
    const text = body.getText();
    
    // Field mapping based on template structure
    const fieldPatterns = {
      'Company Name': /Company Name:\s*(.+?)(?:\n|$)/i,
      'URL': /URL:\s*(.+?)(?:\n|$)/i,
      'Description': /Description:\s*(.+?)(?:\n|$)/i,
      'Location': /Location:\s*(.+?)(?:\n|$)/i,
      'Year founded': /Year founded:\s*(.+?)(?:\n|$)/i,
      'Team size': /Team size:\s*(.+?)(?:\n|$)/i,
      'ARR Run Rate': /ARR Run Rate:\s*(.+?)(?:\n|$)/i,
      '2024 rev': /2024 rev:\s*(.+?)(?:\n|$)/i,
      '2023 rev': /2023 rev:\s*(.+?)(?:\n|$)/i,
      '2022 rev': /2022 rev:\s*(.+?)(?:\n|$)/i,
      'Revenue Notes': /Revenue Notes:\s*(.+?)(?:\n|$)/i,
      '% SaaS Recurring': /% SaaS Recurring:\s*(.+?)(?:\n|$)/i,
      'Gross Margin': /Gross Margin:\s*(.+?)(?:\n|$)/i,
      '# of Customers': /# of Customers:\s*(.+?)(?:\n|$)/i,
      'Customer Notes': /Customer Notes:\s*(.+?)(?:\n|$)/i,
      'Competition': /Competition:\s*(.+?)(?:\n|$)/i,
      'ACV': /ACV:\s*(.+?)(?:\n|$)/i,
      'Logo Churn Annual': /Logo Churn Annual:\s*(.+?)(?:\n|$)/i,
      'Net Revenue Retention': /Net Revenue Retention:\s*(.+?)(?:\n|$)/i,
      'Blended CAC': /Blended CAC:\s*(.+?)(?:\n|$)/i,
      'Payback Period': /Payback Period:\s*(.+?)(?:\n|$)/i,
      'Monthly Burn': /Monthly Burn:\s*(.+?)(?:\n|$)/i,
      'Cash': /Cash:\s*(.+?)(?:\n|$)/i,
      'Runway': /Runway:\s*(.+?)(?:\n|$)/i,
      'Raising': /Raising:\s*(.+?)(?:\n|$)/i,
      'Raised': /Raised:\s*(.+?)(?:\n|$)/i,
      'Active round / fundraise Notes': /Active round \/ fundraise Notes:\s*(.+?)(?:\n|$)/i,
      'Other Funding Notes': /Other Funding Notes:\s*(.+?)(?:\n|$)/i,
      'Good': /Good:\s*(.+?)(?:\n|$)/i,
      'Challenges': /Challenges:\s*(.+?)(?:\n|$)/i,
      'Needs Action': /Needs Action:\s*(.+?)(?:\n|$)/i
    };
    
    const rawFields = {};
    
    // Extract each field using regex patterns
    for (const [fieldName, pattern] of Object.entries(fieldPatterns)) {
      const match = text.match(pattern);
      rawFields[fieldName] = match ? match[1].trim() : '';
    }
    
    return rawFields;
    
  } catch (error) {
    Logger.log(`Error extracting from doc ${docId}: ${error.toString()}`);
    throw error;
  }
}

// === SIMPLE FIELDS BATCH PROCESSING ===

/**
 * Process simple fields in a single batch API call
 * @param {object} rawFields - Raw field values from Google Doc
 * @returns {object} Normalized simple field values
 */
function parseSimpleFieldsBatch(rawFields) {
  const prompt = `
You are a financial data analyst normalizing venture capital due diligence notes into a structured database.

TASK: Extract and normalize the following company fields from raw note data.

NORMALIZATION RULES:
- Convert shorthand to full numbers: "400k" → 400000, "1.2M" → 1200000, "5B" → 5000000000
- Convert percentages to decimals: "15%" → 0.15, "150%" → 1.5, "85%" → 0.85
- Remove currency symbols but preserve numbers: "$50k" → 50000, "$1.2M" → 1200000
- For missing/empty fields, return null (not "NA" string)
- For unclear/ambiguous values, return null rather than guessing
- Preserve meaningful precision for large numbers
- For text fields, clean up formatting but preserve content

FIELD DEFINITIONS:
- arr_run_rate: Annual Recurring Revenue run rate in dollars
- carr: Contracted Annual Recurring Revenue (only if explicitly mentioned as "contracted ARR" or "CARR")
- revenue_2024/2023/2022: Historical revenue figures in dollars
- cash: Current cash position in dollars  
- runway: Runway in months (convert "18 months" → 18)
- raising: Amount currently raising in dollars
- raised: Amount previously raised in dollars
- cac: Customer Acquisition Cost in dollars
- payback_period: Payback period in months
- ltv_to_cac: LTV to CAC ratio as decimal (3.5x → 3.5)
- gross_margin: Gross margin as decimal (85% → 0.85)
- saas_recurring_percent: Percentage of revenue that is SaaS recurring, as decimal
- nrr: Net Revenue Retention as decimal (115% → 1.15)
- team_size: Number of full-time employees as integer
- year_founded: Four-digit founding year as integer
- location: Location string, cleaned up
- description: Company description, cleaned up
- competition: Competition notes, cleaned up  
- revenue_notes: Revenue-related notes, cleaned up
- funding_notes: Funding-related notes, cleaned up
- good: Positive notes, cleaned up
- challenges: Challenge notes, cleaned up
- needs_action: Action items, cleaned up

RAW FIELD DATA:
${JSON.stringify(rawFields, null, 2)}

Extract and normalize these fields. Return null for any field that is missing, empty, or unclear.
`;

  const schema = {
    type: "object",
    properties: {
      arr_run_rate: { type: ["number", "null"] },
      carr: { type: ["number", "null"] },
      revenue_2024: { type: ["number", "null"] },
      revenue_2023: { type: ["number", "null"] },
      revenue_2022: { type: ["number", "null"] },
      cash: { type: ["number", "null"] },
      runway: { type: ["number", "null"] },
      raising: { type: ["number", "null"] },
      raised: { type: ["number", "null"] },
      cac: { type: ["number", "null"] },
      payback_period: { type: ["number", "null"] },
      ltv_to_cac: { type: ["number", "null"] },
      gross_margin: { type: ["number", "null"] },
      saas_recurring_percent: { type: ["number", "null"] },
      nrr: { type: ["number", "null"] },
      team_size: { type: ["integer", "null"] },
      year_founded: { type: ["integer", "null"] },
      location: { type: ["string", "null"] },
      description: { type: ["string", "null"] },
      competition: { type: ["string", "null"] },
      revenue_notes: { type: ["string", "null"] },
      funding_notes: { type: ["string", "null"] },
      good: { type: ["string", "null"] },
      challenges: { type: ["string", "null"] },
      needs_action: { type: ["string", "null"] }
    },
    required: [
      "arr_run_rate", "carr", "revenue_2024", "revenue_2023", "revenue_2022",
      "cash", "runway", "raising", "raised", "cac", "payback_period", "ltv_to_cac",
      "gross_margin", "saas_recurring_percent", "nrr", "team_size", "year_founded",
      "location", "description", "competition", "revenue_notes", "funding_notes",
      "good", "challenges", "needs_action"
    ],
    additionalProperties: false
  };

  return callOpenAIStructured(prompt, schema, "simple_fields_batch");
}

// === COMPLEX FIELD ANALYSIS ===

/**
 * Analyze ACV for potential customer segmentation complexity
 * @param {string} acvRawText - Raw ACV field text
 * @param {object} context - Additional context fields for better analysis
 * @returns {object} ACV analysis result with potential secondary value
 */
function analyzeACVComplexity(acvRawText, context = {}) {
  if (!acvRawText || acvRawText.trim() === '') {
    return { acv: null, acv_2: null };
  }

  const prompt = `
You are analyzing ACV (Annual Contract Value) data for venture capital investment analysis.

CRITICAL COMPLEXITY FILTER:
Only mark as "complex" requiring split if ALL conditions are met:
1. There are clearly distinct customer segments mentioned with specific ACV values
2. The ACV difference between segments is >10x 
3. Both segments represent meaningful revenue (each >20% of total revenue)
4. The segmentation provides actionable business insight (e.g., Enterprise vs SMB)

EXAMPLES OF SIMPLE ACV (return single value):
- "Enterprise customers pay $50k, Pro customers pay $75k" → SIMPLE (1.5x difference)
- "ACV around $20k-30k range" → SIMPLE (single range)
- "Mostly $25k contracts with some at $40k" → SIMPLE (1.6x difference)
- "Mix of monthly and annual contracts averaging $50k ACV" → SIMPLE (single blended)
- "12 customers at 20k, 1 customer at 250k" → SIMPLE (outlier)

EXAMPLES OF COMPLEX ACV (return primary + secondary):
- "3 enterprise customers at $250k each, 300 SMB customers at $800 each" → COMPLEX (312x difference, clear segments)
- "Fortune 500 contracts $500k average, mid-market $15k average" → COMPLEX (33x difference, meaningful segments)
- "Enterprise tier $200k ACV, SMB tier $5k ACV, roughly 50/50 revenue split" → COMPLEX (40x difference, both meaningful)

ADDITIONAL CONTEXT:
Consider the following related information when making your analysis:
- Revenue Notes: "${context.revenue_notes || 'Not provided'}"
- ARR Run Rate: "${context.arr_run_rate || 'Not provided'}"
- Customer Count: "${context.customer_count || 'Not provided'}"

TASK: Analyze the following ACV data and determine if it should be treated as simple or complex.
Use the additional context to inform your decision about customer segmentation and revenue distribution.

Raw ACV data: "${acvRawText}"

If SIMPLE: Extract the single ACV value and return acv_2 as null.
If COMPLEX: Extract both ACV values, with primary ACV being the larger/more important segment.
`;

  const schema = {
    type: "object",
    properties: {
      acv: { type: ["number", "null"] },
      acv_2: { type: ["number", "null"] }
    },
    required: ["acv", "acv_2"],
    additionalProperties: false
  };

  return callOpenAIStructured(prompt, schema, "acv_complexity_analysis");
}

/**
 * Analyze customer count for potential segmentation complexity
 * @param {string} customerRawText - Raw customer count field text  
 * @param {object} context - Additional context fields for better analysis
 * @returns {object} Customer count analysis result with potential secondary value
 */
function analyzeCustomerComplexity(customerRawText, context = {}) {
  if (!customerRawText || customerRawText.trim() === '') {
    return { customer_count: null, customer_count_2: null };
  }

  const prompt = `
You are analyzing customer count data for venture capital investment analysis.

CRITICAL COMPLEXITY FILTER:
Only mark as "complex" requiring split if ALL conditions are met:
1. There are clearly distinct customer segments mentioned with specific counts
2. The customer value difference between segments is >10x (revenue per customer)
3. Both segments represent meaningful revenue (each >20% of total revenue)
4. The segmentation provides actionable business insight

EXAMPLES OF SIMPLE CUSTOMER COUNT (return single value):
- "150 enterprise customers, 200 mid-market customers" → SIMPLE (similar value segments)
- "Mix of monthly and annual customers, about 500 total" → SIMPLE (single total)
- "400 customers across different plan tiers" → SIMPLE (single count)

EXAMPLES OF COMPLEX CUSTOMER COUNT (return primary + secondary):
- "100 enterprise customers at $50k each, 5000 freemium customers at $200 each" → COMPLEX (250x value difference)  
- "50 Fortune 500 clients, 2000 SMB clients with very different contract values" → COMPLEX (clear value segments)

ADDITIONAL CONTEXT:
Consider the following related information when making your analysis:
- Customer Notes: "${context.customer_notes || 'Not provided'}"
- ACV Information: "${context.acv || 'Not provided'}"
- Revenue Notes: "${context.revenue_notes || 'Not provided'}"

TASK: Analyze the following customer count data.
Use the additional context to understand customer segmentation and value differences.

Raw customer data: "${customerRawText}"

If SIMPLE: Extract the single customer count and return customer_count_2 as null.
If COMPLEX: Extract both counts, with primary being the higher-value customer segment.
`;

  const schema = {
    type: "object",
    properties: {
      customer_count: { type: ["integer", "null"] },
      customer_count_2: { type: ["integer", "null"] }
    },
    required: ["customer_count", "customer_count_2"],
    additionalProperties: false
  };

  return callOpenAIStructured(prompt, schema, "customer_complexity_analysis");
}

/**
 * Convert logo churn to annual rate with proper temporal mathematics
 * @param {string} churnRawText - Raw churn field text
 * @returns {object} Annual churn rate
 */
function convertChurnToAnnual(churnRawText) {
  if (!churnRawText || churnRawText.trim() === '') {
    return { logo_churn_annual: null };
  }

  const prompt = `
You are converting logo churn rates to annual rates using proper temporal mathematics.

CRITICAL TEMPORAL CONVERSION RULES:
- If already annual: return as-is
- If monthly: Convert using compound formula: Annual = 1 - (1 - monthly_rate)^12
- NOT simple multiplication by 12 (that's mathematically incorrect)

EXAMPLES:
- "2% monthly churn" → 1 - (1 - 0.02)^12 = 1 - 0.784 = 0.216 (21.6% annual)
- "15% annual churn" → 0.15 (already annual)
- "1% monthly" → 1 - (1 - 0.01)^12 = 1 - 0.886 = 0.114 (11.4% annual)

TASK: Analyze and convert the following churn data to annual rate.

Raw churn data: "${churnRawText}"

Return the annual churn rate as a decimal (15% → 0.15).
`;

  const schema = {
    type: "object",
    properties: {
      logo_churn_annual: { type: ["number", "null"] }
    },
    required: ["logo_churn_annual"],
    additionalProperties: false
  };

  const result = callOpenAIStructured(prompt, schema, "churn_temporal_conversion");
  
  return {
    logo_churn_annual: result.logo_churn_annual
  };
}

// === SPECIAL FIELD PROCESSING ===

/**
 * Normalize monthly burn with special rules for qualitative values
 * @param {string} burnRawText - Raw monthly burn field text
 * @returns {object} Normalized monthly burn value
 */
function normalizeMonthlyBurn(burnRawText) {
  if (!burnRawText || burnRawText.trim() === '') {
    return { monthly_burn: null };
  }

  const prompt = `
You are normalizing monthly burn rate data with special rules for qualitative descriptions.

SPECIAL NORMALIZATION RULES:
- "breakeven" or "profitable" → 0 (no burn)
- "low" → 50000 (standardized low burn amount)
- Numerical values: Apply standard conversion ("$500k" → 500000)
- Unclear/ambiguous → null

EXAMPLES:
- "We're profitable" → 0
- "Breakeven last month" → 0  
- "Low burn rate" → 50000
- "Around $300k monthly" → 300000
- "$1.2M per month" → 1200000
- "Very low expenses" → 50000

TASK: Normalize the following monthly burn data.

Raw burn data: "${burnRawText}"
`;

  const schema = {
    type: "object", 
    properties: {
      monthly_burn: { type: ["number", "null"] }
    },
    required: ["monthly_burn"],
    additionalProperties: false
  };

  const result = callOpenAIStructured(prompt, schema, "monthly_burn_normalization");
  
  return {
    monthly_burn: result.monthly_burn
  };
}

/**
 * Extract last round post-money valuation from funding notes
 * @param {string} fundingNotesText - Combined funding notes text
 * @param {object} context - Additional context for valuation analysis
 * @returns {object} Last round valuation if found
 */
function extractLastRoundValuation(fundingNotesText, context = {}) {
  if (!fundingNotesText || fundingNotesText.trim() === '') {
    return { last_round_valuation: null };
  }

  const prompt = `
You are extracting post-money valuation data from venture capital funding notes.

TASK: Find the most recent funding round's post-money valuation.

LOOK FOR:
- Explicit statements: "Series A at $50M post-money", "valued at $100M post-money"
- Implicit calculations: "Raised $10M for 20% equity" → $50M post-money valuation
- Recent round indicators: "Current round", "This round", "Latest funding", "Just closed"
- Valuation language: "post-money valuation", "company valued at", "post-money"

CONVERSION RULES:
- Pre-money + investment = post-money: "$40M pre-money + $10M raised = $50M post-money"
- Equity percentage: "$10M for 20% = $50M post-money valuation"

IGNORE:
- Old/historical rounds unless explicitly stated as most recent
- Rough estimates, projections, or aspirational valuations
- Secondary market or informal valuations
- Pre-money valuations without investment amount to convert

ADDITIONAL CONTEXT:
Consider this additional information when analyzing funding:
- Previously Raised: "${context.raised || 'Not provided'}"
- Currently Raising: "${context.raising || 'Not provided'}"

EXAMPLES:
- "Series B: $15M at $75M post-money" → 75000000
- "Raised $5M for 10% equity" → 50000000  
- "Previous round was $20M pre-money" → null (not post-money, not recent)
- "Looking to raise at $100M valuation" → null (aspirational)

TASK: Extract post-money valuation from funding notes.
Use the additional context to distinguish between past rounds and current/recent valuations.

Funding notes text: "${fundingNotesText}"
`;

  const schema = {
    type: "object",
    properties: {
      last_round_valuation: { type: ["number", "null"] }
    },
    required: ["last_round_valuation"],
    additionalProperties: false
  };

  const result = callOpenAIStructured(prompt, schema, "valuation_extraction");
  
  return {
    last_round_valuation: result.last_round_valuation
  };
}

// === RECORD ASSEMBLY ===

/**
 * Assemble complete normalized company record with consistent schema
 * @param {string} docId - Google Doc ID
 * @param {object} rawFields - Original raw field values
 * @param {object} simpleFields - Processed simple fields
 * @param {object} acvData - ACV analysis results
 * @param {object} customerData - Customer analysis results  
 * @param {object} churnData - Churn conversion results
 * @param {object} burnData - Burn normalization results
 * @param {object} valuationData - Valuation extraction results
 * @returns {object} Complete company record matching database schema
 */
function assembleCompleteRecord(docId, rawFields, simpleFields, acvData, customerData, churnData, burnData, valuationData) {
  const docUrl = `https://docs.google.com/document/d/${docId}`;
  
  return {
    // === CORE IDENTIFICATION ===
    id: Utilities.getUuid(),
    company_name: rawFields['Company Name'] || null,
    doc_url: docUrl,
    date_created: new Date().toISOString(),
    
    // === FINANCIAL METRICS ===
    arr_run_rate: simpleFields.arr_run_rate,
    carr: simpleFields.carr,
    revenue_2024: simpleFields.revenue_2024,
    revenue_2023: simpleFields.revenue_2023,
    revenue_2022: simpleFields.revenue_2022,
    monthly_burn: burnData.monthly_burn,
    cash: simpleFields.cash,
    runway: simpleFields.runway,
    raising: simpleFields.raising,
    raised: simpleFields.raised,
    last_round_valuation: valuationData.last_round_valuation,
    
    // === CUSTOMER METRICS ===
    acv: acvData.acv,
    acv_2: acvData.acv_2,
    customer_count: customerData.customer_count,
    customer_count_2: customerData.customer_count_2,
    logo_churn_annual: churnData.logo_churn_annual,
    
    // === OTHER METRICS ===
    cac: simpleFields.cac,
    payback_period: simpleFields.payback_period,
    ltv_to_cac: simpleFields.ltv_to_cac,
    gross_margin: simpleFields.gross_margin,
    saas_recurring_percent: simpleFields.saas_recurring_percent,
    nrr: simpleFields.nrr,
    
    // === COMPANY INFO ===
    team_size: simpleFields.team_size,
    year_founded: simpleFields.year_founded,
    location: simpleFields.location,
    description: simpleFields.description,
    competition: simpleFields.competition,
    revenue_notes: simpleFields.revenue_notes,
    funding_notes: simpleFields.funding_notes,
    good: simpleFields.good,
    challenges: simpleFields.challenges,
    needs_action: simpleFields.needs_action
  };
}

// === API UTILITY FUNCTIONS ===

/**
 * Make structured API call to OpenAI responses endpoint
 * @param {string} prompt - Detailed analysis prompt
 * @param {object} schema - JSON schema for structured output
 * @param {string} schemaName - Name identifier for the schema
 * @returns {object} Parsed structured response
 */
function callOpenAIStructured(prompt, schema, schemaName) {
  const payload = {
    model: MODEL,
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        strict: true,
        schema: schema
      }
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    payload: JSON.stringify(payload)
  };

  try {
    const response = UrlFetchApp.fetch(OPENAI_API_URL, options);
    const responseText = response.getContentText();
    
    if (response.getResponseCode() !== 200) {
      Logger.log(`API Error ${response.getResponseCode()}: ${responseText}`);
      throw new Error(`OpenAI API error: ${response.getResponseCode()}`);
    }
    
    const result = JSON.parse(responseText);
    const message = result.output.find(item => item.type === "message");
    
    if (!message || !message.content || !message.content[0]) {
      throw new Error("Invalid API response structure");
    }
    
    return JSON.parse(message.content[0].text);
    
  } catch (error) {
    Logger.log(`Error in OpenAI API call for ${schemaName}: ${error.toString()}`);
    throw error;
  }
}

// === TEST FUNCTION ===

/**
 * Test function to parse a single company document
 * Replace with actual Google Doc ID for testing
 */
function testParseCompany() {
  const testDocId = "1FSBUo3aXlRSTC_sRXung-N_RqUiqau8ioQ5iQpd8jMU"; // Replace with real doc ID
  
  try {
    const result = parseCompanyFromDoc(testDocId);
    Logger.log("Parse successful!");
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    Logger.log(`Test failed: ${error.toString()}`);
    throw error;
  }
}
