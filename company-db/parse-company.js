/**
 * @fileoverview Company Data Parser - Extract and normalize company metrics from Google Docs
 * 
 * This system parses VC due diligence notes from Google Docs into clean, structured database records.
 * Uses OpenAI responses API with strict JSON schemas for reliable data extraction.
 * 
 * Architecture:
 * - Extract full text content from Google Doc
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
    
    // Stage 1: Extract full text from Google Doc
    const docText = DocumentApp.openById(docId).getBody().getText();
    Logger.log(`Extracted document text.`);
    
    // Stage 2: Process simple fields in single batch
    const simpleFields = parseSimpleFieldsBatch(docText);
    Logger.log(`Processed simple fields batch.`);
    
    // Stage 3: Analyze complex fields individually with full context
    const acvData = analyzeACVComplexity(docText);
    const customerData = analyzeCustomerComplexity(docText);
    const churnData = convertChurnToAnnual(docText);
    Logger.log(`Analyzed complex fields.`);
    
    // Stage 4: Process special fields
    const burnData = normalizeMonthlyBurn(docText);
    const valuationData = extractLastRoundValuation(docText);
    Logger.log(`Processed special fields.`);
    
    // Stage 5: Assemble complete record
    const completeRecord = assembleCompleteRecord(
      docId, simpleFields, acvData, customerData, 
      churnData, burnData, valuationData
    );
    
    Logger.log(`Successfully parsed company: ${completeRecord.company_name}`);
    return completeRecord;
    
  } catch (error) {
    Logger.log(`Error parsing company from doc ${docId}: ${error.toString()}`);
    throw error;
  }
}

// === SIMPLE FIELDS BATCH PROCESSING ===

/**
 * Process simple fields in a single batch API call
 * @param {string} docText - Full text content from Google Doc
 * @returns {object} Normalized simple field values
 */
function parseSimpleFieldsBatch(docText) {
  const prompt = `
You are a financial data analyst normalizing venture capital due diligence notes into a structured database.

TASK: From the document text provided, extract and normalize the company fields listed in the JSON schema.

NORMALIZATION RULES:
- Convert shorthand to full numbers: "400k" → 400000, "1.2M" → 1200000, "5B" → 5000000000
- Convert percentages to decimals: "15%" → 0.15, "150%" → 1.5, "85%" → 0.85
- Remove currency symbols but preserve numbers: "$50k" → 50000, "$1.2M" → 1200000
- For missing/empty fields, return null (not "NA" string)
- For unclear/ambiguous values, return null rather than guessing
- Preserve meaningful precision for large numbers
- For text fields, clean up formatting but preserve content

FIELD DEFINITIONS:
- company_name: The name of the company.
- url: The company's website URL.
- arr_run_rate: Annual Recurring Revenue run rate in dollars.
- carr: Contracted Annual Recurring Revenue (only if explicitly mentioned as "contracted ARR" or "CARR").
- revenue_2024/2023/2022: Historical revenue figures in dollars.
- cash: Current cash position in dollars.  
- runway: Runway in months (convert "18 months" → 18).
- raising: Amount currently raising in dollars.
- raised: Amount previously raised in dollars.
- cac: Customer Acquisition Cost in dollars.
- payback_period: Payback period in months.
- ltv_to_cac: LTV to CAC ratio as decimal (3.5x → 3.5).
- gross_margin: Gross margin as decimal (85% → 0.85).
- saas_recurring_percent: Percentage of revenue that is SaaS recurring, as decimal.
- nrr: Net Revenue Retention as decimal (115% → 1.15).
- team_size: Number of full-time employees as integer.
- year_founded: Four-digit founding year as integer.
- location: Location string, cleaned up.
- description: Company description, cleaned up.
- competition: Competition notes, cleaned up.  
- revenue_notes: Revenue-related notes, cleaned up.
- funding_notes: Funding-related notes (combine "Active round" and "Other Funding" notes).
- good: Positive notes, cleaned up.
- challenges: Challenge notes, cleaned up.
- needs_action: Action items, cleaned up.

DOCUMENT TEXT:
---
${docText}
---

Extract and normalize these fields based on the entire document. Return null for any field that is missing, empty, or unclear.
`;

  const schema = {
    type: "object",
    properties: {
      company_name: { type: ["string", "null"] },
      url: { type: ["string", "null"] },
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
      "company_name", "url", "arr_run_rate", "carr", "revenue_2024", "revenue_2023", "revenue_2022",
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
 * @param {string} docText - Full text content from Google Doc
 * @returns {object} ACV analysis result with potential secondary value
 */
function analyzeACVComplexity(docText) {
  if (!docText || docText.trim() === '') {
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

TASK: Analyze the ACV data within the following document. Use the full context of the document to identify customer segments, revenue distribution, and other relevant factors.

DOCUMENT TEXT:
---
${docText}
---

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
 * @param {string} docText - Full text content from Google Doc
 * @returns {object} Customer count analysis result with potential secondary value
 */
function analyzeCustomerComplexity(docText) {
  if (!docText || docText.trim() === '') {
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

TASK: Analyze the customer count data within the following document. Use the full context to understand segmentation and value differences.

DOCUMENT TEXT:
---
${docText}
---

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
 * @param {string} docText - Full text content from Google Doc
 * @returns {object} Annual churn rate
 */
function convertChurnToAnnual(docText) {
  if (!docText || docText.trim() === '') {
    return { logo_churn_annual: null };
  }

  const prompt = `
You are converting a logo churn rate to an annual rate using proper temporal mathematics.

CRITICAL TEMPORAL CONVERSION RULES:
- If rate is already annual: return as-is.
- If rate is monthly: Convert using the compound formula: Annual = 1 - (1 - monthly_rate)^12
- Do NOT use simple multiplication (e.g., monthly * 12), as it's mathematically incorrect for compounding rates.

EXAMPLES:
- "2% monthly churn" → 1 - (1 - 0.02)^12 = 1 - 0.784 = 0.216 (21.6% annual)
- "15% annual churn" → 0.15 (already annual)
- "1% monthly" → 1 - (1 - 0.01)^12 = 1 - 0.886 = 0.114 (11.4% annual)
- "Logo Churn Annual: 10%" -> 0.10

TASK: Find the logo churn rate in the document, identify its period (monthly or annual), and convert it to an annual rate.

DOCUMENT TEXT:
---
${docText}
---

Return the final annual churn rate as a decimal (e.g., 15% → 0.15). If no churn data is found, return null.
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
 * @param {string} docText - Full text content from Google Doc
 * @returns {object} Normalized monthly burn value
 */
function normalizeMonthlyBurn(docText) {
  if (!docText || docText.trim() === '') {
    return { monthly_burn: null };
  }

  const prompt = `
You are normalizing monthly burn rate data, with special rules for qualitative descriptions.

SPECIAL NORMALIZATION RULES:
- "breakeven", "profitable", "cash flow positive" → 0 (no burn)
- "low burn" → 50000 (standardized low burn amount)
- Numerical values: Apply standard conversion ("$500k" → 500000)
- Unclear/ambiguous descriptions → null

EXAMPLES:
- "We're profitable" → 0
- "Breakeven last month" → 0  
- "Low burn rate" → 50000
- "Around $300k monthly" → 300000
- "Very low expenses" → 50000

TASK: Find and normalize the monthly burn data from the following document.

DOCUMENT TEXT:
---
${docText}
---

Return the normalized monthly burn. If no burn data is found, return null.
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
 * @param {string} docText - Full text content from Google Doc
 * @returns {object} Last round valuation if found
 */
function extractLastRoundValuation(docText) {
  if (!docText || docText.trim() === '') {
    return { last_round_valuation: null };
  }

  const prompt = `
You are extracting post-money valuation data from venture capital funding notes.

TASK: Find the most recent funding round's post-money valuation from the document.

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
- Rough estimates, projections, or aspirational valuations for future rounds
- Secondary market or informal valuations
- Pre-money valuations without investment amount to convert

EXAMPLES:
- "Series B: $15M at $75M post-money" → 75000000
- "Raised $5M for 10% equity" → 50000000  
- "Previous round was $20M pre-money" → null (not post-money, not recent)
- "Looking to raise at $100M valuation" → null (aspirational)

TASK: Extract the most recent, confirmed post-money valuation from the document text.

DOCUMENT TEXT:
---
${docText}
---

Return the valuation. If no clear, recent, post-money valuation is found, return null.
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
 * @param {object} simpleFields - Processed simple fields
 * @param {object} acvData - ACV analysis results
 * @param {object} customerData - Customer analysis results  
 * @param {object} churnData - Churn conversion results
 * @param {object} burnData - Burn normalization results
 * @param {object} valuationData - Valuation extraction results
 * @returns {object} Complete company record matching database schema
 */
function assembleCompleteRecord(docId, simpleFields, acvData, customerData, churnData, burnData, valuationData) {
  const docUrl = `https://docs.google.com/document/d/${docId}`;
  
  return {
    // === CORE IDENTIFICATION ===
    id: Utilities.getUuid(),
    company_name: simpleFields.company_name,
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
    url: simpleFields.url,
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