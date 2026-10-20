"use client";
import {useState,useEffect,useCallback,useRef} from "react";
import {fetchMyOrders,confirmPharmacistCart,type StoreOrder,type StoreCartItem} from "@/lib/api";
import {errorMessage,price,statusLabel,switchCartItem} from "@/lib/marketplace";
import {useMarketplace} from "./MarketplaceProvider";
import {Panel,ErrorBanner,button,secondary} from "./MarketplaceUI";
export default function MyOrdersDrawer({isOpen,onClose}:{isOpen:boolean;onClose:()=>void}) {
  const store=useMarketplace();const [orders,setOrders]=useState<StoreOrder[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState<string|null>(null),[drafts,setDrafts]=useState<Record<string,StoreCartItem[]>>({});const submitting=useRef(false);
  const load=useCallback(async()=>{setLoading(true);try{setOrders(await fetchMyOrders());setError(null);}catch(error){setError(errorMessage(error));}finally{setLoading(false);}},[]);
  useEffect(()=>{if(isOpen){setOrders([]);setDrafts({});void load();}},[isOpen,load]);
  async function confirm(order:StoreOrder) {
    if(submitting.current||!store.requireAuth())return;submitting.current=true;setBusy(order.id);setError(null);
    try{await confirmPharmacistCart(order.id,drafts[order.id]?{items:drafts[order.id]}:{});setDrafts({});await load();void store.refreshCatalog();}
    catch(error){setError(errorMessage(error));}finally{submitting.current=false;setBusy(null);}
  }
  if(!isOpen)return null;
  return <Panel title="My orders" onClose={()=>{if(!busy)onClose();}} drawer><button className={secondary} disabled={loading||!!busy} onClick={()=>void load()}>Refresh orders</button><ErrorBanner message={error}/>{loading&&<p role="status">Loading orders…</p>}{!loading&&!orders.length&&!error&&<p className="py-8 text-muted">No orders yet. Browse the catalog or send a prescription to your pharmacist.</p>}
    {orders.map(order=>{
      const draft=drafts[order.id];
      const quotes=draft?.map(item=>{const original=order.items.find(row=>row.medicine_id===item.medicine_id),alternative=order.items.find(row=>row.cheapest_alternative?.medicine_id===item.medicine_id)?.cheapest_alternative;
        const amount=store.catalog.find(m=>m.medicine_id===item.medicine_id)?.selling_price??original?.unit_price??alternative?.selling_price;
        return amount==null?null:Number(amount)*item.quantity;});
      const total=quotes?(quotes.some(amount=>amount===null)?null:quotes.reduce<number>((sum,amount)=>sum+(amount??0),0)):order.total_amount;
      return <article key={order.id} className="rounded-2xl border border-border bg-surface p-4 space-y-3"><div className="flex justify-between gap-3"><h3 className="font-semibold">{statusLabel[order.status]}</h3>{order.is_demo&&<span className="text-xs text-amber-800">Demo order</span>}</div><p className="text-xs text-muted break-all">{new Date(order.created_at).toLocaleString("en-PK")} · {order.id}</p>
      {order.status==="CART_READY_FOR_USER"&&<p className="rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 text-sm font-semibold">Pharmacist verified and built your cart. Review the medicines and pack quantities before confirming.</p>}
      {order.items.map(original=>{const chosen=draft?.find(item=>(item.switched_from_medicine_id??item.medicine_id)===original.medicine_id),med=chosen?store.catalog.find(m=>m.medicine_id===chosen.medicine_id):null;const swapped=!!chosen&&chosen.medicine_id!==original.medicine_id;
        return <div key={original.medicine_id} className="border-t border-border pt-3 space-y-2 text-sm"><p className="font-semibold">{med?.brand_name??original.brand_name} {med?.strength??original.strength} · {med?.dosage_form??original.dosage_form}</p><p>{chosen?.quantity??original.quantity} pack(s) · {price(med?.selling_price??original.unit_price)} per pack</p>
        {order.status==="CART_READY_FOR_USER"&&original.cheapest_alternative&&!swapped&&<button className={secondary} disabled={!!busy} onClick={()=>{try{setDrafts(current=>({...current,[order.id]:switchCartItem(current[order.id]??order.items.map(item=>({medicine_id:item.medicine_id,quantity:item.quantity})),original.medicine_id,original.cheapest_alternative!)}));}catch(error){setError(errorMessage(error));}}}>Switch to cheaper generic: {original.cheapest_alternative.brand_name} · save {price(original.cheapest_alternative.savings_pkr)}</button>}
        {swapped&&<p className="text-emerald-800 text-xs">Alternative selected; the server will recheck compatibility and stock.</p>}</div>;
      })}
      <p className="font-bold">{draft?"Estimated updated total":"Order total"}: {price(total)}</p>{draft&&<button className={secondary} disabled={!!busy} onClick={()=>setDrafts(current=>{const next={...current};delete next[order.id];return next;})}>Reset switches</button>}
      {order.status==="CART_READY_FOR_USER"&&<button className={button+" w-full"} disabled={!!busy||loading} onClick={()=>void confirm(order)}>{busy===order.id?"Confirming…":"Confirm & Place Order"}</button>}
      {order.status==="AWAITING_PHARMACIST_CART"&&<p className="text-xs text-muted">Your prescription is in the pharmacist queue. Refresh to check for a prepared cart.</p>}
      {order.status==="PENDING_RX_REVIEW"&&<p className="text-xs text-muted">Stock is not deducted until pharmacist approval.</p>}
    </article>;})}
  </Panel>;
}
