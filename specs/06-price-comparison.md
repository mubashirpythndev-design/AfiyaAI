# 06 Price Comparison Specification

## 1. Goal
Define safe price comparison for verified medicines.

## 2. Scope
- Compare prices across different sources/manufacturers for the same generic/strength/form.

## 3. Out of Scope
- Real-time live scraping of prices.

## 4. Inputs
- Verified medicine entity.

## 5. Outputs
- List of prices, sources, and calculated savings.

## 6. Functional Requirements
- Match medicines based on generic, strength, dosage form, and package/unit.
- Calculate potential savings between brands.

## 7. Technical Design
- SQL queries against `medicine_prices` and `medicines` tables.

## 8. Workflow
Identify verified medicine → match generic/strength/form/package → retrieve source prices → compare → calculate savings → show source/date.

## 9. Error/Edge Cases
- Stale or missing price data.
- Incomparable package sizes.

## 10. Security/Safety Considerations
- Price MUST come from stored source data.
- LLM MUST NEVER invent prices.

## 11. Acceptance Criteria
- Accurately displays stored prices and correct savings calculations.

## 12. Testing Requirements
- Math verification for savings.
- Handling of missing price records.

## 13. Open Questions
- None.
