"use client";
import {useMemo,useRef,useState} from "react";
import {ArrowLeft,ArrowRight,Check,Filter,Package,Plus,RefreshCw,Search,ShoppingBag,Stethoscope,X} from "lucide-react";
import {useMarketplace} from "./MarketplaceProvider";
import {price,text} from "@/lib/marketplace";
import {catalogCategories,catalogPage,filterCatalog,type CatalogFilters} from "@/lib/catalog";
import type {Language} from "@/lib/types";
import {getCategoryDisplayName} from "@/lib/constants";
import {secondary,input,ErrorBanner} from "./MarketplaceUI";
import DemoNotice from "./DemoNotice";

export function AddToCartButton({medicineId,language="en"}:{medicineId:string;language?:Language}) {
  const store=useMarketplace(),med=store.catalog.find(item=>item.medicine_id===medicineId);
  const inCart=store.items.some(item=>item.medicine_id===medicineId);
  return <button type="button" className={secondary+" catalog-add"} disabled={!med?.available||store.catalogLoading} onClick={()=>store.addItems([{medicine_id:medicineId,quantity:1}])}>
    {inCart?<Check size={16}/>:<Plus size={16}/>}
    {text(language,inCart?"Add another pack":"Add to cart",inCart?"ایک اور پیک شامل کریں":"کارٹ میں شامل کریں",inCart?"Ek aur pack shamil karein":"Cart mein shamil karein")}
    {!store.catalogLoading&&!med?.available&&<span className="text-xs">· unavailable</span>}
  </button>;
}
const initialFilters:CatalogFilters={query:"",category:"",prescription:"",availableOnly:false,sort:"name"};
export default function StoreCatalog({language,prescriptionFile}:{language:Language;prescriptionFile:File|null}) {
  const store=useMarketplace(),[filters,setFilters]=useState(initialFilters),[page,setPage]=useState(1);
  const resultsRef=useRef<HTMLDivElement>(null);
  const categories=useMemo(()=>catalogCategories(store.catalog),[store.catalog]);
  const filtered=useMemo(()=>filterCatalog(store.catalog,filters),[store.catalog,filters]);
  const current=catalogPage(filtered,page);
  const active=!!(filters.query||filters.category||filters.prescription||filters.availableOnly);
  function update(patch:Partial<CatalogFilters>) {setFilters(previous=>({...previous,...patch}));setPage(1);}
  function go(next:number) {setPage(next);resultsRef.current?.focus({preventScroll:true});resultsRef.current?.scrollIntoView({block:"start",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});}
  return <section id="store-catalog" className="page-shell store-section">
    {store.catalog.some(item=>item.is_demo_seller)&&<DemoNotice/>}
    <div className="catalog-heading"><div><p className="eyebrow"><span className="eyebrow-rule"/>THE PHARMACY DIRECTORY</p><h2>{text(language,"Your medicines. Clearly priced.","آپ کی دوائیں، واضح قیمتوں کے ساتھ","Aap ki dawaein. Wazeh qeematon ke saath.")}</h2><p>Compare stored reference prices, check pack sizes and build a cart for pharmacist review.</p></div><button className={secondary} onClick={()=>store.openConcierge(prescriptionFile)}><Stethoscope size={17}/>Send a prescription</button></div>
    <div className="catalog-toolbar">
      <label className="catalog-search"><Search size={18}/><span className="sr-only">Search store catalog</span><input value={filters.query} onChange={event=>update({query:event.target.value})} placeholder="Search brand, generic or category" type="search"/></label>
      <div className="catalog-filters"><label><span><Filter size={13}/>Category</span><select aria-label="Category" className={input} value={filters.category} onChange={event=>update({category:event.target.value})}><option value="">All categories</option>{categories.map(category=><option key={category} value={category}>{getCategoryDisplayName(category,language)} / {category}</option>)}</select></label>
      <label><span>Prescription</span><select aria-label="Prescription" className={input} value={filters.prescription} onChange={event=>update({prescription:event.target.value})}><option value="">All medicines</option><option value="otc">OTC only</option><option value="rx">Prescription required</option></select></label>
      <label><span>Sort by</span><select aria-label="Sort by" className={input} value={filters.sort} onChange={event=>update({sort:event.target.value})}><option value="name">Name: A–Z</option><option value="price-asc">Pack price: low to high</option><option value="price-desc">Pack price: high to low</option></select></label></div>
      <div className="catalog-toolbar-bottom"><label className="catalog-stock-toggle"><input type="checkbox" checked={filters.availableOnly} onChange={event=>update({availableOnly:event.target.checked})}/>Available to order only</label><div className="flex flex-wrap gap-3">{active&&<button className="quiet-link" onClick={()=>{setFilters(initialFilters);setPage(1);}}><X size={14}/>Clear filters</button>}<button className="quiet-link" disabled={store.catalogLoading} onClick={()=>void store.refreshCatalog()}><RefreshCw size={14} className={store.catalogLoading?"animate-spin":""}/>Refresh stock</button></div></div>
    </div>
    <ErrorBanner message={store.catalogError}/>
    <div ref={resultsRef} tabIndex={-1} className="catalog-results-heading" aria-live="polite"><p>{store.catalogLoading?"Updating catalog…":`${current.start}–${current.end} of ${filtered.length} medicines`}</p><span>Prices per whole pack · Local demo sellers</span></div>
    {store.catalogLoading&&!store.catalog.length?<div role="status" className="catalog-empty"><RefreshCw size={24} className="animate-spin"/><h3>Loading the pharmacy directory</h3></div>:!filtered.length&&!store.catalogError?<div className="catalog-empty"><Search size={28}/><h3>No medicines found</h3><p>Try a different name or broaden your filters.</p><button className={secondary} onClick={()=>{setFilters(initialFilters);setPage(1);}}>Clear filters</button></div>:null}
    <div className="catalog-grid">{current.items.map(med=><article key={med.medicine_id} className="catalog-card">
      <div className="catalog-card-top"><span className="catalog-product-icon"><Package size={22} strokeWidth={1.5}/></span><span className={`market-badge ${med.requires_prescription===true?"market-badge-rx":""}`}>{med.requires_prescription===true?"Rx required":med.requires_prescription===false?"OTC":"Rx status unknown"}</span></div>
      <div className="catalog-product-copy"><p className="catalog-category">{med.category?getCategoryDisplayName(med.category,language):"Category not recorded"}</p><h3>{med.brand_name}</h3><p>{med.strength} {med.dosage_form}</p><p className="catalog-generic">{med.generic_name}</p></div>
      <div className="catalog-price"><strong>{price(med.selling_price)}</strong><span>per pack · {med.pack_size||"size not recorded"}</span></div>
      <div className="catalog-reference"><span className={`catalog-stock ${med.available?"is-available":""}`}><span/>{med.available?`${med.stock_quantity} packs available`:"Currently unavailable"}</span><span>Reference MRP: {price(med.notified_mrp)}</span><span>{med.notified_mrp!==null?"Stored DRAP-aligned price reference":"Unverified demo price"}</span></div>
      {med.batch_recalled&&<p className="text-xs text-danger">Batch on hold — unavailable for purchase</p>}
      <div className="catalog-card-footer"><AddToCartButton medicineId={med.medicine_id} language={language}/><p>{med.seller_name??"No seller assigned"}{med.is_demo_seller?" · Demo seller":""}</p></div>
    </article>)}</div>
    {filtered.length>0&&<nav aria-label="Store catalog pages" className="catalog-pagination"><button className={secondary} disabled={current.page===1} onClick={()=>go(current.page-1)}><ArrowLeft size={16}/><span>Previous</span></button><div className="catalog-page-numbers">{Array.from({length:current.pages},(_,index)=>index+1).map(number=><button key={number} aria-label={`Page ${number}`} aria-current={current.page===number?"page":undefined} onClick={()=>go(number)}>{number}</button>)}</div><button className={secondary} disabled={current.page===current.pages} onClick={()=>go(current.page+1)}><span>Next</span><ArrowRight size={16}/></button><p>Page {current.page} of {current.pages}</p></nav>}
    <p className="catalog-disclosure">Catalog categories describe stored medicine classifications. They are not symptom-based treatment recommendations. Confirm medicine choices with a doctor or pharmacist.</p>
    <button className="catalog-mobile-cart" onClick={store.openCart}><ShoppingBag size={18}/>View smart cart<span>{store.items.reduce((sum,item)=>sum+item.quantity,0)}</span></button>
  </section>;
}
