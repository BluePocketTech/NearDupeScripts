// Click the "gear" icon in the top right to view settings
let config = input.config({
  title: "Group Near Duplicates Config",
  description:
    "Configure the table and fields to find duplicates and group them.",
  items: [
    input.config.table("table", {
      label: "Table name",
      description: "Select the table you want to process",
    }),
    input.config.field("fieldToProcess", {
      label: "Field to check",
      description:
        "Select the field that contains the data you want to process",
      parentTable: "table",
    }),
    input.config.field("groupField", {
      label: "Group Field",
      description: "Select the field where the groups will be written to",
      parentTable: "table",
    }),
    input.config.select("dedupeMethod", {
      label: "Deduplication Method",
      description: "Choose the deduplication strategy",
      options: [
        { label: "Exact Match", value: "exact" },
        { label: "Fuzzy Match", value: "fuzzy" },
        { label: "Ignore Case", value: "ignore_case" },
      ],
    }),
    input.config.number("fuzzyThreshold", {
      label: "Fuzzy Match Threshold",
      description:
        "Choose 1 for a close match. Choose a larger number for a looser threshold.",
    }),
  ],
});

// Retrieve variables
let { table, fieldToProcess, groupField, dedupeMethod, fuzzyThreshold } =
  config;

// Default fuzzyThreshold to 3 if it's not provided
fuzzyThreshold = fuzzyThreshold || 3;

// Helper: Levenshtein Distance Function (for fuzzy matching)
function levenshtein(a, b) {
  if (!a || !b) return (a || b).length;
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        a[j - 1] === b[i - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j - 1] + 1
            );
    }
  }
  return matrix[b.length][a.length];
}

// Step 1: Load the table and fetch all records
let query = await table.selectRecordsAsync({ fields: [fieldToProcess] });
let records = query.records;

// Step 2: Create a mapping to track groups of duplicates
let valueToGroupID = {};
let groups = {}; // To store grouped record IDs for assigning GroupIDs
let nextGroupID = 1; // Initialize the starting group number

// Helper: Find existing group for a value (for fuzzy and case-insensitive matching)
function findMatchingGroup(value) {
  for (let existingValue in valueToGroupID) {
    if (dedupeMethod === "case-insensitive") {
      if (existingValue.toLowerCase() === value.toLowerCase()) {
        return valueToGroupID[existingValue];
      }
    } else if (dedupeMethod === "fuzzy") {
      let distance = levenshtein(existingValue, value);
      if (distance <= fuzzyThreshold) {
        return valueToGroupID[existingValue];
      }
    }
  }
  return null; // No match found
}

// Step 3: Process each record
for (let record of records) {
  let value = record.getCellValue(fieldToProcess.id);

  // Skip records with an empty or null value
  if (!value) {
    continue;
  }

  let groupID;

  // Check if the value already exists in groups
  if (dedupeMethod === "exact") {
    // Exact matching
    groupID = valueToGroupID[value];
  } else {
    // Case-insensitive or fuzzy matching
    groupID = findMatchingGroup(value);
  }

  if (groupID) {
    // Add record to an existing group
    groups[groupID].push(record.id);
  } else {
    // Create a new group for this value
    groupID = `Group ${nextGroupID}`;
    valueToGroupID[value] = groupID;
    groups[groupID] = [record.id];
    nextGroupID++;
  }
}

// Step 4: Prepare updates for records
let updates = [];
for (let groupID in groups) {
  for (let recordID of groups[groupID]) {
    updates.push({
      id: recordID,
      fields: {
        [groupField.id]: groupID, // Assign the GroupID to the 'Duplicate Group' field
      },
    });
  }
}

// Step 5: Apply updates in batches (max 50 records per batch)
while (updates.length > 0) {
  await table.updateRecordsAsync(updates.slice(0, 50));
  updates = updates.slice(50);
}

// Output a message indicating the deduplication is complete
output.markdown(
  `**Deduplication Completed!** Group IDs have been assigned using the "${dedupeMethod}" method.`
);
