---
name: medical-safety
description: Procedural step-by-step verification workflow for medical safety before finalizing a response.
---

# Medical Safety Skill

This Skill represents a procedural check, not the permanent rule. Apply this before finalizing a medical response.

## Pre-finalization Checklist
Before sending the final response to the user, execute this checklist:
- [ ] Are all structured medicine facts strictly from the authoritative database?
- [ ] Is there ANY language that attempts to diagnose a symptom? (If yes, rewrite/block).
- [ ] Is there ANY language that prescribes a dosage based on user symptoms? (If yes, rewrite/block).
- [ ] Are all claims supported by the `knowledge_chunks` context?
- [ ] Are sources and provenance clearly displayed next to pricing or factual claims?
- [ ] Is the standard medical professional disclaimer attached?
- [ ] If information was missing, is the response explicitly stating the information is unavailable rather than guessing?
