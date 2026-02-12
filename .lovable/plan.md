

## Bulk Insert 15 Expense Records for 2006 N Ashley Street

All 15 expense records will be inserted into the `maintenance_records` table using a single database operation.

### Common Values for All Records
- **Property:** 2006 N Ashley Street, Valdosta (ID: `d59ab0c8-907f-47da-b6b9-4be8639a0f8a`)
- **Manager:** `c0170867-f0ce-4bef-a2cf-980536882e01`
- **Paid By:** Zack (ID: `ae4f7e00-da66-424b-ba51-f4a57f2031f9`, name stored as "zack")
- **Split:** 50%
- **Status:** completed

### Records to Insert

| Date | Amount | Title |
|------|--------|-------|
| 2025-05-16 | $27,062.79 | Roof Repaired, 2 Split payment was made by Regions Checking account |
| 2025-07-14 | $400.00 | Electrical Wires Fixed |
| 2025-07-28 | $213.00 | Ceiling Lights Led |
| 2025-07-28 | $1,200.00 | Lowes Material |
| 2025-08-01 | $1,500.00 | Labor paid to Robert |
| 2025-07-31 | $150.00 | Paint for Ceiling |
| 2025-08-02 | $1,000.00 | Electrician |
| 2025-08-05 | $5,000.00 | Robert Labor |
| 2025-08-07 | $500.00 | Robert Labor |
| 2025-08-09 | $1,330.00 | Lowes Material (4x8 Panels and brad nails) |
| 2025-08-09 | $200.00 | Dumpster for 2006 N Ashley |
| 2025-08-06 | $58.40 | Hiscox Insurance |
| 2025-08-07 | $29.16 | Hiscox Insurance |
| 2025-08-13 | $500.00 | Labor |
| 2025-08-14 | $139.00 | Paint (81 paid on 08/11/2025, rest today) |

**Total: $39,282.35**

### Technical Details

A single SQL `INSERT` into `maintenance_records` with all 15 rows. Each row will have:
- `property_id`: the 2006 N Ashley property UUID
- `manager_id`: the authenticated manager UUID
- `title`: the description from the spreadsheet
- `total_cost`: the dollar amount
- `performed_by`: Zack's `expense_people` UUID
- `performed_by_name`: "zack"
- `ownership_split_percentage`: 50
- `status`: "completed"
- `performed_date`: the date from the spreadsheet (YYYY-MM-DD format)

No code changes are needed -- this is a data-only operation using the existing database insert tool.

