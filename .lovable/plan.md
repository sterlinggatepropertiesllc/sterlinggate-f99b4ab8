

## Bulk Insert 17 Expense Records for 507 East Ann St

All 17 expense records will be inserted into the `maintenance_records` table using a single database operation.

### Common Values for All Records
- **Property:** 507 East Ann St (ID: `f14cba60-259c-4929-9ca1-bff8ba52b71b`)
- **Manager:** `c0170867-f0ce-4bef-a2cf-980536882e01`
- **Paid By:** Zack (ID: `ae4f7e00-da66-424b-ba51-f4a57f2031f9`, name stored as "zack")
- **Split:** 50%
- **Status:** completed

### Records to Insert

| Date | Amount | Title |
|------|--------|-------|
| 2024-02-28 | $10,000.00 | Earnest Money Paid by me |
| 2025-03-01 | $110.00 | Lock Rekey Unit 503 |
| 2025-05-02 | $110.00 | Lock Rekey 507 |
| 2025-06-11 | $110.00 | Lock Rekey 509 |
| 2025-07-09 | $45.00 | For Rent Banners (x3) |
| 2025-07-14 | $250.00 | Dumpster Rental |
| 2025-07-16 | $200.00 | Dumpster |
| 2025-07-17 | $200.00 | Dumpster |
| 2025-07-16 | $300.00 | Labor to Remove Stuff from Unit |
| 2025-07-16 | $198.00 | Metal Roof Material |
| 2025-07-22 | $65.00 | Landfill Charge for the Dump |
| 2025-07-19 | $92.00 | Landfill Charge for the Dump |
| 2025-07-17 | $86.00 | Landfill Charge for the Dump |
| 2025-07-27 | $1,000.00 | Labor Paid to Robert |
| 2025-08-06 | $119.20 | Hiscox Insurance |
| 2025-08-09 | $45.90 | Rent Banner |
| 2025-08-07 | $32.07 | Hiscox Insurance |

**Total: $12,963.17**

### Technical Details

A single SQL `INSERT` into `maintenance_records` with all 17 rows. Each row will have:
- `property_id`: `f14cba60-259c-4929-9ca1-bff8ba52b71b`
- `manager_id`: `c0170867-f0ce-4bef-a2cf-980536882e01`
- `title`: the description from the spreadsheet
- `total_cost`: the dollar amount
- `performed_by`: `ae4f7e00-da66-424b-ba51-f4a57f2031f9`
- `performed_by_name`: "zack"
- `ownership_split_percentage`: 50
- `status`: "completed"
- `performed_date`: the date from the spreadsheet (YYYY-MM-DD format)

No code changes are needed -- this is a data-only operation using the existing database insert tool.

