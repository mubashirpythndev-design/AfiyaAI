---
name: price-comparison
description: Workflow for comparing prices of verified medicines.
---

# Price Comparison Skill

## Workflow
1. Identify verified medicine.
2. Match generic/strength/form/package.
3. Retrieve source prices from database.
4. Compare prices.
5. Calculate savings.
6. Show source and date if available.

## Crucial Rule
- NEVER ask the LLM to calculate or invent source prices.
