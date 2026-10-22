import Image from "next/image";

/** The supplied Afiya artwork, alongside the visible brand name. */
export default function BrandLogo({priority=false}:{priority?:boolean}) {
  return <Image src="/afiya-logo-6dad2394.png" alt="" width={40} height={40} className="brand-logo" priority={priority}/>;
}
