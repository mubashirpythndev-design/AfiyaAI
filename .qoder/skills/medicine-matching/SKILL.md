---
name: medicine-matching
description: Workflow for matching unverified candidates against the verified database.
---

# Medicine Matching Skill

## Workflow
1. **Receive Candidate**: Take the `OCR candidate` or user text.
2. **Normalization**: Standardize the text (lowercase, remove special characters). (Output: `normalized medicine` string).
3. **Matching Strategy**:
   - Exact match against the 40-medicine database.
   - Alias match (checking known synonyms).
   - Fuzzy match (calculating Levenshtein distance).
4. **Candidate Ranking**: Rank matches by confidence score.
5. **Verification Check**:
   - If confidence > threshold: Mark as `verified medicine`.
   - If confidence <= threshold: Do not silently verify. Prompt user for manual confirmation.
