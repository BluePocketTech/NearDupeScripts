// Click the "gear" icon in the top right to view settings
let config = input.config({
  title: "Google Knowledge Graph ID Fetcher",
  description: "Fetches entity IDs using the Google Knowledge Graph API.",
  items: [
    input.config.table("selectedTable", {
      label: "Table to use",
      description: "Pick any table in this base!",
    }),
    input.config.field("fieldToCheck", {
      label: "Field containing the query text",
      parentTable: "selectedTable",
    }),
    input.config.field("idField", {
      label: "Field to store the Knowledge Graph entity ID",
      parentTable: "selectedTable",
    }),
    input.config.text("entityType", {
      label: "Entity Type",
      description: "Movie, Book, Organization?",
    }),
    input.config.text("apiKey", {
      label: "Google Knowledge Graph API Key",
      description: "Enter your Google Knowledge Graph API key",
    }),
  ],
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let { selectedTable, fieldToCheck, idField, apiKey, entityType } = config;

let query = await selectedTable.selectRecordsAsync({
  fields: [fieldToCheck, idField],
});

for (let record of query.records) {
  let baseQuery = record.getCellValueAsString(fieldToCheck);
  if (!baseQuery) continue;

  let fullQuery = `${baseQuery}`.trim();
  console.log(fullQuery);
  let encodedQuery = encodeURIComponent(fullQuery);
  let url = `https://kgsearch.googleapis.com/v1/entities:search?query=${encodedQuery}&types=${entityType}&key=${apiKey}&limit=1`;

  let response = await fetch(url);
  if (!response.ok) {
    console.error(`Failed to fetch for "${fullQuery}": ${response.statusText}`);
    continue;
  }

  let result = await response.json();
  console.log(result);
  let entity = result?.itemListElement?.[0]?.result;
  let entityId = entity?.["@id"] || null;

  if (entityId) {
    await selectedTable.updateRecordAsync(record.id, {
      [idField.id]: entityId,
    });
  }

  await delay(300); // prevent rapid API hits
}

output.text("✅ All records processed and entity IDs stored!");
