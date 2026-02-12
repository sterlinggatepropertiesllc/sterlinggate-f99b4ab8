

## Filter Property Dropdown to Only Show Properties With Expenses

The property filter dropdown on the Maintenance dashboard currently lists all properties, even ones with no maintenance records. This change will filter it to only show properties that actually have at least one expense record.

### What Changes

In `src/components/maintenance/MaintenanceDashboard.tsx`, the property filter `<Select>` currently lists all properties from `useManagerProperties`. Instead, it will compute a filtered list of properties that have at least one record in the `records` array, and only show those in the dropdown.

### Technical Details

- Create a `propertiesWithRecords` memo that filters the `properties` list to only include properties whose `id` appears in at least one maintenance record
- Replace the `properties?.map(...)` in the Select dropdown with `propertiesWithRecords.map(...)`
- The "All Properties" option remains as-is
- No database or backend changes needed

