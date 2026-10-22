import type { MedicineCandidate, MatchResponse } from "./types";

type Matcher = (text: string, strength?: string | null, form?: string | null) => Promise<MatchResponse>;
export async function enrichOCRCandidates(candidates: MedicineCandidate[], matcher: Matcher): Promise<MedicineCandidate[]> {
  const result: MedicineCandidate[] = new Array(candidates.length);
  let next = 0;
  async function worker() {
    while (next < candidates.length) {
      const index = next++;
      const candidate = candidates[index];
      if (candidate.unreadable || !candidate.raw_text.trim()) { result[index] = { ...candidate, is_verified: false, matched_medicine: null, needs_confirmation: true }; continue; }
      try {
        const match = await matcher(candidate.raw_text, candidate.detected_strength, candidate.detected_form);
        const mismatch = match.strength_assessment?.status === "STRENGTH_MISMATCH" || match.form_assessment?.status === "FORM_MISMATCH";
        const resolved = Boolean(match.medicine && !match.needs_confirmation && !match.lasa_warning?.confirmation_required && !mismatch);
        result[index] = { ...candidate, match_confidence: match.confidence,
          is_verified: resolved && candidate.reviewed === true,
          needs_confirmation: candidate.reviewed !== true || !resolved,
          matched_medicine: match.medicine, safety: match.safety ?? candidate.safety,
          strength_assessment: match.strength_assessment, form_assessment: match.form_assessment };
      } catch {
        result[index] = { ...candidate, is_verified: false, matched_medicine: null, needs_confirmation: true };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, worker));
  return result;
}

function overlap(a?: number[] | null, b?: number[] | null) {
  if (!a || !b) return false;
  const area = Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0])) * Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
  const smaller = Math.min((a[2]-a[0])*(a[3]-a[1]),(b[2]-b[0])*(b[3]-b[1]));
  return smaller > 0 && area/smaller > 0.5;
}
export function mergeOCRRescan(existing: MedicineCandidate[], additions: MedicineCandidate[]): MedicineCandidate[] {
  const result = existing.map(c => ({ ...c }));
  const matched = new Set<number>();
  for (const addition of additions) {
    let index = -1, bestOverlap = -1;
    existing.forEach((c, i) => {
      if (matched.has(i)) return;
      const sameBox = overlap(c.bbox, addition.bbox);
      if (!sameBox && !(!c.bbox && !addition.bbox && c.raw_line === addition.raw_line && c.raw_text === addition.raw_text)) return;
      let score = 0;
      if (sameBox && c.bbox && addition.bbox) {
        const a = c.bbox, b = addition.bbox;
        const intersection = Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0])) * Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
        const union = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - intersection;
        score = union > 0 ? intersection / union : 0;
      }
      if (score > bestOverlap) { index = i; bestOverlap = score; }
    });
    if (index >= 0) matched.add(index);
    if (index < 0) result.push({ ...addition, line_id: "rescan-" + (result.length + 1), reviewed: false, is_verified: false, needs_confirmation: true });
    else if (result[index].unreadable && !addition.unreadable) result[index] = { ...addition, line_id: result[index].line_id, reviewed: false, is_verified: false };
    else if (!addition.unreadable && result[index].raw_text !== addition.raw_text) result[index] = { ...result[index], alternative_reading: addition.raw_text, reviewed: false, is_verified: false, needs_confirmation: true };
  }
  return result;
}
