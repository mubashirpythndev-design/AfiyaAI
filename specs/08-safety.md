# 08 Safety Specification

## 1. Goal
Define strict medical safety requirements for the AI assistant.

## 2. Scope
- Guardrails for all outputs and system behaviors.

## 3. Out of Scope
- Regulatory compliance (e.g., HIPAA/GDPR) beyond hackathon scope, though principles apply.

## 4. Inputs
- All system prompts and user inputs.

## 5. Outputs
- Safe, grounded, and disclaimed responses.

## 6. Functional Requirements
- Refuse to diagnose or prescribe.
- Disclose uncertainty.
- Display medical professional disclaimers.

## 7. Technical Design
- System prompt constraints.
- Output validation checks where applicable.

## 8. Workflow
Pre-generation safety prompt → Generation → Post-generation safety check (optional) → Delivery with disclaimers.

## 9. Error/Edge Cases
- Jailbreak attempts to bypass safety rules.
- Emergency or high-risk situations (e.g., self-harm, severe symptoms).

## 10. Security/Safety Considerations
- No diagnosis.
- No prescribing.
- No fabricated medical facts.
- No fabricated prices or sources.
- Retrieved info preferred over model memory.
- Emergency queries must be deflected to real medical professionals immediately.

## 11. Acceptance Criteria
- System passes a suite of adversarial medical safety tests.

## 12. Testing Requirements
- Extensive safety testing against edge cases and dangerous queries.

## 13. Open Questions
- None.
