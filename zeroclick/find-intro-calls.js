/**
 * @fileoverview This script scans Google Calendar events for the current day,
 * identifies "introductory calls" with founders using an OpenAI classifier,
 * and returns a list of summaries for those calls.
 *
 * Note: This script requires the `OPENAI_API_KEY` to be set as a script property.
 */

/**
 * Scans today's calendar events and returns a list of summaries for events
 * identified as "intro calls."
 *
 * @returns {Array<object>} A list of summary objects for each intro call found.
 *                          Each object contains the event's title, time, description, and attendees.
 */
function processTodayCalendarEvents() {
  const introCallSummaries = [];
  const calendar = CalendarApp.getDefaultCalendar();

  // Set the time range to scan for events (all of today).
  const now = new Date();
  const start = new Date(now.setHours(0, 0, 0, 0));
  const end = new Date(now.setHours(23, 59, 59, 999));

  Logger.log(`Scanning calendar events between ${start} and ${end}...`);

  const events = calendar.getEvents(start, end);
  Logger.log(`Found ${events.length} event(s).`);

  // Iterate through each event to classify it.
  events.forEach(event => {
    const title = event.getTitle();
    const description = event.getDescription();
    const attendees = event.getGuestList().map(g => g.getEmail()).join(', ');
    const time = event.getStartTime().toLocaleString();

    const summary = {
      title,
      time,
      description,
      attendees
    };

    Logger.log(`\nChecking event:\n${summary.title}\n${summary.time}\n${summary.description}\n${summary.attendees}`);

    // Use OpenAI to determine if the event is an intro call.
    const isIntroCall = OpenAIClassifyIntroCall(summary);

    if (isIntroCall) {
      Logger.log("✅ Marked as intro call.");
      introCallSummaries.push(summary);
    } else {
      Logger.log("❌ Not an intro call.");
    }
  });

  Logger.log(`\nReturning ${introCallSummaries.length} intro call(s).`);
  return introCallSummaries;
}

/**
 * Calls OpenAI to classify if a calendar event is an introductory call with a founder.
 *
 * @param {object} summary - An object containing the event's title, time, description, and attendees.
 * @returns {boolean} True if the event is classified as an intro call, otherwise false.
 */
function OpenAIClassifyIntroCall(summary) {
  const formattedSummary = `
  Title: ${summary.title}
  Time: ${summary.time}
  Description: ${summary.description}
  Attendees: ${summary.attendees}
  `.trim();

  const payload = {
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are helping triage calendar invites for a venture capitalist by determining whether or not a given calendar invite is an introductory call. Some features of an intro call are - Description: Event Name: Intro Call, or the only two or three members are my email (james@scopvc.com), possibly mike's email (miket@scopvc.com), and a founder, with an email not from a VC firm, but from a company. Team pitches that include all of our team (kevin@scopvc.com, cormac@scopvc.com, ivan@scopvc.com), and a founder are NOT intro calls. Intro calls are where it's either just me (james@scopvc.com), or me and miket@scopvc.com, with one or more participants from another company. Respond only with 'Yes' if it is an intro call or 'No' if it's not."
      },
      {
        role: "user",
        content: `Is the following event an intro call with a startup founder?\n\n${formattedSummary}`
      }
    ]
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
    const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", options);
    const responseText = response.getContentText();
    Logger.log(`Raw GPT response: ${responseText}`);

    const result = JSON.parse(responseText);
    const answer = result.choices[0].message.content.trim().toLowerCase();

    return answer === 'yes';
  } catch (e) {
    Logger.log(`Error calling GPT: ${e}`);
    return false; // fallback to safe default
  }
}

