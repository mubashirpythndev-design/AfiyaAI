import {imageType, prescriptionUser, savePrescription} from "@/lib/local-prescriptions";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const user = await prescriptionUser(request);
    if (!user) return Response.json({detail:"Not authenticated"},{status:401});
    if (Number(request.headers.get("content-length")) > 11*1024*1024) return Response.json({detail:"Image must be under 10 MB"},{status:413});
    if (!request.body) return Response.json({detail:"Select a prescription image"},{status:422});
    const reader=request.body.getReader(), chunks:Uint8Array[]=[];
    let size=0;
    while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;
      if(size>11*1024*1024){await reader.cancel();return Response.json({detail:"Image must be under 10 MB"},{status:413});}
      chunks.push(chunk.value);
    }
    const body=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}
    const bounded=new Request(request.url,{method:"POST",headers:request.headers,body});
    const file = (await bounded.formData()).get("image");
    if (!(file instanceof File) || !file.size || file.size > 10*1024*1024) return Response.json({detail:"Select a JPEG, PNG or WebP image under 10 MB"},{status:422});
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = imageType(bytes);
    if (!type) return Response.json({detail:"Only JPEG, PNG and WebP photos are supported"},{status:422});
    return Response.json({prescription_image_url:await savePrescription(bytes,user.id,type)},{headers:{"Cache-Control":"no-store"}});
  } catch { return Response.json({detail:"Could not store the prescription locally. Check that the backend is running and retry."},{status:503}); }
}
