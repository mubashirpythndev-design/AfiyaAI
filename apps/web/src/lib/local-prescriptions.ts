/** Compatibility adapter: private attachment bytes live in the API database. */
import "server-only";
import {API_BASE_URL} from "./constants";

type PrescriptionUser = {id:string; is_admin:boolean; authorization:string};
export async function prescriptionUser(request: Request): Promise<PrescriptionUser | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization || !API_BASE_URL) return null;
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {headers:{authorization},cache:"no-store",signal:AbortSignal.timeout(15000)});
  if (!response.ok) return null;
  const user = await response.json();
  return {...user,authorization};
}
export function imageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (Buffer.from(bytes.slice(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (Buffer.from(bytes.slice(0,4)).toString() === "RIFF" && Buffer.from(bytes.slice(8,12)).toString() === "WEBP") return "image/webp";
  return null;
}
export async function savePrescription(bytes: Uint8Array, _owner: string, type: string, authorization: string): Promise<string> {
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(bytes)], {type}), "prescription");
  const response = await fetch(`${API_BASE_URL}/api/v1/store/prescriptions`, {
    method:"POST",headers:{authorization},body:form,cache:"no-store",signal:AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error("Prescription storage unavailable");
  const result = await response.json();
  return result.prescription_image_url;
}
export async function readPrescription(id: string, user: PrescriptionUser): Promise<{bytes:Buffer; type:string} | null> {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  const response = await fetch(`${API_BASE_URL}/api/v1/store/prescriptions/${id}`, {
    headers:{authorization:user.authorization},cache:"no-store",signal:AbortSignal.timeout(30000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Prescription unavailable");
  return {bytes:Buffer.from(await response.arrayBuffer()),type:response.headers.get("content-type") || "application/octet-stream"};
}
