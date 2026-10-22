"use client";
import type { ReactNode } from "react";
import { LazyMotion, domAnimation, m, MotionConfig } from "framer-motion";
import { ArrowRight, ArrowUpRight, BookOpen, Archive, ScanLine, Pill, ShieldCheck, Languages, HeartPulse, Wind, Droplets, FlaskConical, Wallet, Search, FileCheck2, MessageSquare } from "lucide-react";
import type { Language } from "@/lib/types";
import { CATEGORY_ITEMS } from "@/lib/constants";
import ImageUploader from "@/components/upload/ImageUploader";
import FeedbackCard from "@/components/feedback/FeedbackCard";

const categoryIcons=[Pill,ShieldCheck,ShieldCheck,HeartPulse,HeartPulse,Wind,Droplets,HeartPulse,HeartPulse,FlaskConical,Wind];
type Props={language:Language;children:ReactNode;chat:ReactNode;onCategory:(category:string)=>void;onUpload:(file:File)=>void;prescriptionFile:File|null;onRemoveImage:()=>void;isProcessing:boolean;isScanning:boolean;isAuthenticated:boolean;onRequireAuth:()=>void;onGuide:()=>void;onFeedback:()=>void;onCabinet:()=>void};
export default function HomeLanding({language,children,chat,onCategory,onUpload,prescriptionFile,onRemoveImage,isProcessing,isScanning,isAuthenticated,onRequireAuth,onGuide,onFeedback,onCabinet}:Props) {
 const text=(en:string,ur:string,roman:string)=>language==="ur"?ur:language==="roman_ur"?roman:en;
 return <MotionConfig reducedMotion="user"><LazyMotion features={domAnimation} strict>
  <section className="home-intro" dir={language==="ur"?"rtl":undefined}>
   <div className="page-shell">
    <m.div initial={false} animate={{opacity:1}} className="intro-heading">
     <p className="eyebrow"><span className="eyebrow-rule"/>{text("YOUR EVERYDAY MEDICINE COMPANION","آپ کی دواؤں کا روزمرہ ساتھی","AAP KI DAWAIYON KA ROZMARAH SAATHI")}</p>
     <h1>{text("A little clarity.","دواؤں کی واضح معلومات۔","Dawai ki wazeh maloomat.")} <span>{text("A healthier everyday.","روزمرہ کے لیے آسانی۔","Rozmarah mein aasani.")}</span></h1>
     <div className="intro-bottom"><p>{text("Find medicine information, compare reference prices, and keep your prescriptions organised. All in one considered space.","دوا کی معلومات حاصل کریں، حوالہ قیمتوں کا موازنہ کریں اور اپنے نسخے ایک جگہ منظم رکھیں۔","Dawai ki maloomat dekhein, reference qeematon ka muqabla karein aur apne nuskhe ek jagah munazzam rakhein.")}</p><button className="quiet-link" onClick={onGuide}><BookOpen size={17}/>{text("A quick guide","استعمال کی رہنمائی","Istemaal ki rehnumai")}<ArrowUpRight size={15}/></button></div>
    </m.div>
    <div className="workspace-grid">
     <m.div initial={false} whileHover={{y:-2}} transition={{duration:.2}} className="search-workspace">
      <div className="section-kicker"><Search size={18}/><span>{text("01 / FIND A MEDICINE","01 / دوا تلاش کریں","01 / DAWAI TALASH KAREIN")}</span></div>
      <h2>{text("Know your medicine.","اپنی دوا کے بارے میں جانیں۔","Apni dawai ke bare mein janein.")}</h2>
      <p className="workspace-description">{text("Search by brand or generic name to explore information and available reference prices.","برانڈ یا جنیرک نام سے معلومات اور دستیاب حوالہ قیمتیں تلاش کریں۔","Brand ya generic naam se maloomat aur dastiyab reference qeematein talash karein.")}</p>
      {children}
      <div className="search-examples"><span>{text("For example","مثلاً","Misal ke taur par")}</span><span>Panadol</span><span>Paracetamol</span><span>Risek</span></div>
      <div className="workspace-note"><ShieldCheck size={16}/><span>{text("Reference information. Always confirm with your pharmacist.","حوالہ معلومات۔ ہمیشہ اپنے فارماسسٹ سے تصدیق کریں۔","Reference maloomat. Hamesha pharmacist se tasdeeq karein.")}</span></div>
     </m.div>
     <m.div initial={false} whileHover={{y:-2}} transition={{duration:.2}} className="scan-workspace" id="prescription-upload">
      <div className="section-kicker"><ScanLine size={18}/><span>{text("02 / READ A PRESCRIPTION","02 / نسخہ پڑھیں","02 / NUSKHA PARHEIN")}</span></div>
      <ImageUploader file={prescriptionFile} onImageRemoved={onRemoveImage} onImageSelected={onUpload} isProcessing={isProcessing} showProgress={isScanning} language={language} isAuthenticated={isAuthenticated} onRequireAuth={onRequireAuth}/>
     </m.div>
    </div>
    <div className="home-service-row">
     <span><Languages size={18}/>{text("English, Urdu & Roman Urdu","انگریزی، اردو اور رومن اردو","English, Urdu aur Roman Urdu")}</span>
     <span><Wallet size={18}/>{text("Reference price comparison","حوالہ قیمتوں کا موازنہ","Reference qeematon ka muqabla")}</span>
     <button onClick={onCabinet}><Archive size={18}/>{text("Your personal medicine cabinet","آپ کی دواؤں کی کیبنٹ","Aap ki dawaiyon ki cabinet")}<ArrowUpRight size={14}/></button>
    </div>
   </div>
  </section>
  <section className="home-categories" id="categories" dir={language==="ur"?"rtl":undefined}>
   <div className="page-shell">
    <div className="section-heading"><div><p className="eyebrow">{text("THE MEDICINE DIRECTORY","دواؤں کی فہرست","DAWAIYON KI FEHRIST")}</p><h2>{text("Explore by category.","اقسام کے لحاظ سے دیکھیں۔","Category ke lihaz se dekhein.")}</h2></div><p>{text("Browse our supported medicine groups. For treatment decisions, consult a qualified healthcare professional.","دستیاب دواؤں کی اقسام دیکھیں۔ علاج کے فیصلوں کے لیے مستند طبی ماہر سے رجوع کریں۔","Dastiyab dawaiyon ki categories dekhein. Ilaaj ke faislon ke liye qualified healthcare professional se mashwara karein.")}</p></div>
    <div className="category-directory">{CATEGORY_ITEMS.map((item,index)=>{const Icon=categoryIcons[index]??Pill;return <button key={item.id} onClick={()=>onCategory(item.id)} className="directory-item"><Icon size={21} strokeWidth={1.5}/><span><strong>{language==="ur"?item.nameUrdu:language==="roman_ur"?item.nameRomanUrdu:item.name}</strong><small>{item.medicalTerm}</small></span><ArrowUpRight size={16} className="directory-arrow"/></button>})}</div>
   </div>
  </section>
  <section className="home-process" id="how-it-works" dir={language==="ur"?"rtl":undefined}><div className="page-shell"><div className="section-heading"><div><p className="eyebrow">{text("SIMPLE BY DESIGN","آسان استعمال","ASAAN ISTEMAAL")}</p><h2>{text("From prescription to perspective.","نسخے سے واضح معلومات تک۔","Nuskhe se wazeh maloomat tak.")}</h2></div><button onClick={onGuide} className="quiet-link">{text("View the guide","رہنمائی دیکھیں","Rehnumai dekhein")}<ArrowRight size={17}/></button></div><div className="process-grid">{[
  {Icon:Search,title:text("Find or scan","تلاش یا اسکین کریں","Talash ya scan karein"),body:text("Enter a medicine name or upload a clear photo of your prescription.","دوا کا نام درج کریں یا نسخے کی واضح تصویر اپ لوڈ کریں۔","Dawai ka naam dein ya nuskhe ki clear tasveer upload karein.")},
  {Icon:FileCheck2,title:text("Review the details","معلومات چیک کریں","Maloomat check karein"),body:text("Compare each scanned entry with your original prescription before using it.","استعمال سے پہلے ہر اسکین شدہ اندراج کو اصل نسخے سے ملائیں۔","Istemaal se pehle har scanned entry ko original nuskhe se milayein.")},
  {Icon:Archive,title:text("Keep it organised","منظم رکھیں","Munazzam rakhein"),body:text("Compare reference prices and save confirmed medicines to your cabinet.","حوالہ قیمتوں کا موازنہ کریں اور تصدیق شدہ دوائیں کیبنٹ میں محفوظ کریں۔","Reference qeematein compare karein aur confirmed dawaiyan cabinet mein save karein.")}
 ].map(({Icon,title,body},i)=><m.article key={i} initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.2}} transition={{duration:.35,delay:i*.06}} className="process-item"><div className="process-top"><Icon size={23} strokeWidth={1.5}/><span>0{i+1}</span></div><h3>{title}</h3><p>{body}</p></m.article>)}</div></div></section>
  <section id="features" className="home-principles" dir={language==="ur"?"rtl":undefined}><div className="page-shell principles-layout"><div><p className="eyebrow">{text("INFORMATION YOU CAN QUESTION","معلومات اور ان کا ماخذ","MALOOMAT AUR UNKA MAKHIZ")}</p><h2>{text("Clear sources.","واضح ذرائع۔","Wazeh sources.")}<br/>{text("Considered decisions.","سمجھ کر فیصلے۔","Samajh kar faislay.")}</h2></div><div className="principles-list"><article><ShieldCheck size={22}/><div><h3>{text("Sources stay visible","ذرائع واضح رہتے ہیں","Sources wazeh rehte hain")}</h3><p>{text("Stored reference prices and source information help you check the details. Pharmacy prices and availability can change.","محفوظ حوالہ قیمتیں اور ذرائع معلومات کی جانچ میں مدد دیتے ہیں۔ فارمیسی قیمتیں اور دستیابی بدل سکتی ہیں۔","Stored reference qeematein aur sources details check karne mein madad dete hain. Pharmacy ki qeematein aur availability badal sakti hain.")}</p></div></article><article><FileCheck2 size={22}/><div><h3>{text("Your review comes first","آپ کی تصدیق پہلے","Aap ki tasdeeq pehle")}</h3><p>{text("Scanning is AI-assisted and may miss or misread entries. Always review the original image. Afiya does not diagnose or prescribe.","اسکین میں اے آئی مدد کرتی ہے اور غلطی ہو سکتی ہے۔ اصل تصویر ہمیشہ چیک کریں۔ افیہ تشخیص یا دوا تجویز نہیں کرتی۔","Scanning AI-assisted hai aur entries miss ya ghalat parhi ja sakti hain. Original image hamesha check karein. Afiya diagnosis ya dawa prescribe nahi karti.")}</p></div></article><a href="https://e.dra.gov.pk/public/price" target="_blank" rel="noopener noreferrer" className="quiet-link">{text("Visit the DRAP reference portal","DRAP حوالہ پورٹل دیکھیں","DRAP reference portal dekhein")}<ArrowUpRight size={16}/></a></div></div></section>
  <section className="home-chat" id="medicine-help" dir={language==="ur"?"rtl":undefined}><div className="page-shell chat-layout"><div className="chat-intro"><p className="eyebrow">{text("A LITTLE MORE CONTEXT","مزید معلومات","MAZEED MALOOMAT")}</p><h2>{text("Questions about your medicine?","اپنی دوا کے بارے میں سوال؟","Apni dawai ke bare mein sawal?")}</h2><p>{text("Explore medicine information in the language you are comfortable with. This AI-assisted tool provides information, not medical advice.","اپنی پسند کی زبان میں دوا کی معلومات حاصل کریں۔ یہ اے آئی معاون ٹول معلومات دیتا ہے، طبی مشورہ نہیں۔","Apni pasand ki zaban mein dawai ki maloomat hasil karein. Yeh AI-assisted tool maloomat deta hai, medical advice nahi.")}</p><div className="chat-language-note"><MessageSquare size={18}/><span>English · اردو · Roman Urdu</span></div></div><div className="chat-workspace">{chat}</div></div></section>
  <div id="feedback" className="page-shell home-feedback"><FeedbackCard language={language} onOpenModal={onFeedback}/></div>
 </LazyMotion></MotionConfig>;
}
