/** Local disk storage only. Each image is private to its buyer and backend-authorized admins. */
import "server-only";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {API_BASE_URL} from "./constants";

const directory = path.resolve(process.cwd(), "../../.local/marketplace-prescriptions");
export async function prescriptionUser(request: Request): Promise<{id:string; is_admin:boolean} | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization || !API_BASE_URL) return null;
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {headers:{authorization},cache:"no-store",signal:AbortSignal.timeout(15000)});
  if (!response.ok) return null;
  return response.json();
}
export function imageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (Buffer.from(bytes.slice(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (Buffer.from(bytes.slice(0,4)).toString() === "RIFF" && Buffer.from(bytes.slice(8,12)).toString() === "WEBP") return "image/webp";
  return null;
}
export async function savePrescription(bytes: Uint8Array, owner: string, type: string): Promise<string> {
  const id = randomUUID();
  await mkdir(directory,{recursive:true});
  await writeFile(path.join(directory,id),bytes,{flag:"wx",mode:0o600});
  await writeFile(path.join(directory,id+".json"),JSON.stringify({owner,type}),{flag:"wx",mode:0o600});
  return `/uploads/${id}`;
}
export async function readPrescription(id: string, user: {id:string; is_admin:boolean}): Promise<{bytes:Buffer; type:string} | null> {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  try {
    const meta = JSON.parse(await readFile(path.join(directory,id+".json"),"utf8")) as {owner:string;type:string};
    if (meta.owner !== user.id && !user.is_admin) return null;
    return {bytes:await readFile(path.join(directory,id)),type:meta.type};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
