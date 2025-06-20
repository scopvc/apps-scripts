/**
 * @fileoverview This script extracts company information using a two-step OpenAI API process.
 * First, it gets company details from a domain, then it finds the LinkedIn URL.
 *
 * Note: This script requires the `OPENAI_API_KEY` to be set as a script property.
 */

/**
 * Main function to generate enriched company information from a call summary.
 * It identifies the primary company domain and then uses a two-step OpenAI process
 * to fetch all required company details.
 *
 * @param {object} summary - An object containing call details, including a comma-separated string of attendee emails.
 * @returns {object} An object containing the company's website, LinkedIn URL, name, description, location, and year founded.
 */
function generateCompanyInfo(summary) {
  // Extract external email domains from the list of attendees.
  const externalEmails = summary.attendees
    .split(',')
    .map(e => e.trim())
    .filter(email => !email.toLowerCase().endsWith('@scopvc.com'));

  // Determine the primary domain from the list of unique domains.
  const domains = [...new Set(externalEmails.map(e => e.split('@')[1]))];
  const primaryDomain = domains.length > 0 ? domains[0] : null;

  // If no external domain is found, return null values.
  if (!primaryDomain) {
    return { website: null, linkedin: null, name: null, description: null, location: null, yearFounded: null };
  }
  Logger.log(`Primary external domain: ${primaryDomain}`);

  // Step 1: Get primary company details (everything except LinkedIn).
  const companyDetails = getCompanyDetailsFromDomain(primaryDomain);
  Logger.log(`Company Details: ${JSON.stringify(companyDetails)}`);

  // Step 2: Find the LinkedIn URL using the company name and description.
  const linkedinUrl = findLinkedInUrl(companyDetails.name, companyDetails.description);
  Logger.log(`Found LinkedIn URL: ${linkedinUrl}`);

  // Step 3: Extract the counterpart's name from the meeting title.
  const counterpartName = extractCounterpartName(summary.title);
  Logger.log(`Extracted counterpart name: ${counterpartName}`);

  // Combine all gathered information into a single object.
  return {
    website: companyDetails.website,
    linkedin: linkedinUrl,
    name: companyDetails.name,
    description: companyDetails.description,
    location: companyDetails.location,
    yearFounded: companyDetails.yearFounded,
    counterpartName: counterpartName
  };
}

/**
 * Gets company details (website, description, name, location, founded year) from a domain.
 * @param {string} domain The company domain.
 * @returns {object} The company details.
 */
function getCompanyDetailsFromDomain(domain) {
  const payload = {
    model: "gpt-4.1",
    tools: [{ type: "web_search_preview" }],
    input: `From the domain "${domain}", find the company's official website, a one-sentence description, its name, headquarters location, and the year it was founded. You may need to visit the company website to find all details. If any field isn't available, return 'NA' for it.`,
    text: {
      format: {
        type: "json_schema",
        name: "company_details_from_domain",
        strict: true,
        schema: {
          type: "object",
          properties: {
            website: { type: "string", description: "The official website of the company." },
            description: { type: "string", description: "A one-sentence description of the company." },
            name: { type: "string", description: "The name of the company." },
            location: { type: "string", description: "The headquarters location of the company." },
            yearFounded: { type: "string", description: "The year the company was founded." }
          },
          required: ["website", "description", "name", "location", "yearFounded"],
          additionalProperties: false
        }
      }
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    payload: JSON.stringify(payload)
  };

  try {
    const response = UrlFetchApp.fetch("https://api.openai.com/v1/responses", options);
    const result = JSON.parse(response.getContentText());
    const message = result.output.find(item => item.type === "message");
    return JSON.parse(message.content[0].text);
  } catch (e) {
    Logger.log(`Error getting company details: ${e}`);
    return { website: "NA", description: "NA", name: "NA", location: "NA", yearFounded: "NA" };
  }
}

/**
 * Finds a company's LinkedIn URL using its name and description.
 * @param {string} name The name of the company.
 * @param {string} description A description of the company.
 * @returns {string} The LinkedIn company page URL.
 */
function findLinkedInUrl(name, description) {
  if (!name || name === "NA") {
    return "NA";
  }
  const payload = {
    model: "gpt-4o",
    tools: [{ type: "web_search_preview" }],
    input: `Find the official LinkedIn company page for a company named "${name}" with the description "${description}". Return only the URL. If you are not able to find the company, return "NA".`,
    text: {
      format: {
        type: "json_schema",
        name: "linkedin_finder",
        strict: true,
        schema: {
          type: "object",
          properties: {
            linkedinUrl: { type: "string", description: "The official LinkedIn company page URL." }
          },
          required: ["linkedinUrl"],
          additionalProperties: false
        }
      }
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    payload: JSON.stringify(payload)
  };

  try {
    const response = UrlFetchApp.fetch("https://api.openai.com/v1/responses", options);
    const result = JSON.parse(response.getContentText());
    const message = result.output.find(item => item.type === "message");
    const parsed = JSON.parse(message.content[0].text);
    return parsed.linkedinUrl || "NA";
  } catch (e) {
    Logger.log(`Error finding LinkedIn URL: ${e}`);
    return "NA";
  }
}

/**
 * Extracts the counterpart's name from a meeting title by removing internal participants.
 *
 * @param {string} title The meeting title (e.g., "Jon Kokot and James Freedman").
 * @returns {string} The cleaned-up name of the external participant.
 */
function extractCounterpartName(title) {
  const internalNames = ["James Freedman", "Mike Tucker, Ivan Bercovich"];
  let counterpartName = title;

  // Remove internal names from the title string.
  internalNames.forEach(name => {
    counterpartName = counterpartName.replace(new RegExp(name, 'gi'), '');
  });

  // Remove common connectors and clean up the string.
  counterpartName = counterpartName.replace(/ and | \+ | & | w\/ /gi, ' ');
  counterpartName = counterpartName.replace(/[+&]/g, ' ');
  counterpartName = counterpartName.trim().replace(/\s+/g, ' ');

  // If multiple names remain (e.g., separated by a comma), take the first one.
  if (counterpartName.includes(',')) {
    counterpartName = counterpartName.split(',')[0].trim();
  }

  return counterpartName;
}



