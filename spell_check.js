// Click the "gear" icon in the top right to view settings
let config = input.config({
  title: "JSpell Checker",
  description: "This script checks and corrects spelling using the JSpell API.",
  items: [
    input.config.table("selectedTable", {
      label: "Table to use",
      description: "Pick any table in this base!",
    }),
    input.config.field("fieldToCheck", {
      label: "Field inside the above table",
      parentTable: "selectedTable",
    }),
    input.config.text("apiKey", {
      label: "JSpell API Key",
      description: "Enter your JSpell API key",
    }),
  ],
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyCorrections(originalText, elements) {
  let corrected = originalText;
  let offsetAdjustment = 0;

  for (const el of elements) {
    for (const error of el.errors.reverse()) {
      const incorrectWord = error.word;
      const start = error.position + offsetAdjustment;
      const end = start + incorrectWord.length;

      const replacement = error.suggestions[0] || incorrectWord;

      // Reconstruct the string
      corrected =
        corrected.slice(0, start) + replacement + corrected.slice(end);
    }
  }

  return corrected;
}

// Destructure input
let { selectedTable, fieldToCheck, apiKey } = config;

// Get the records (sorted the same as in the view)
let query = await selectedTable.selectRecordsAsync({
  // Only get the field specified by the user
  fields: [fieldToCheck],
});

for (let record of query.records) {
  let originalText = record.getCellValueAsString(fieldToCheck);
  if (!originalText) continue;

  // Prepare request body
  const body = JSON.stringify({
    language: "enUS",
    fieldvalues: originalText,
    config: {
      forceUpperCase: false,
      ignoreIrregularCaps: false,
      ignoreFirstCaps: true,
      ignoreNumbers: true,
      ignoreUpper: false,
      ignoreDouble: false,
      ignoreWordsWithNumbers: true,
    },
  });

  const response = await fetch("https://jspell-checker.p.rapidapi.com/check", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "jspell-checker.p.rapidapi.com",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.elements) {
    continue;
  }

  let correctedText = applyCorrections(originalText, result.elements);

  // Update the record with corrected version
  await selectedTable.updateRecordAsync(record.id, {
    [fieldToCheck.id]: correctedText,
  });

  await delay(4000); // respect the rate limit
}

output.text("✅ All records processed and corrected!");
