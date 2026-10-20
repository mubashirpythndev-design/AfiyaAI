import {prescriptionUser, readPrescription} from "@/lib/local-prescriptions";
export const runtime = "nodejs";
export async function GET(request: Request, context: {params:Promise<{id:string}>}) {
  try {
    const user = await prescriptionUser(request);
    if (!user) return new Response("Not authenticated",{status:401});
    const image = await readPrescription((await context.params).id,user);
    if (!image) return new Response("Not found",{status:404});
    return new Response(new Uint8Array(image.bytes),{headers:{"Content-Type":image.type,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'"}});
  } catch { return new Response("Prescription unavailable",{status:503}); }
}
