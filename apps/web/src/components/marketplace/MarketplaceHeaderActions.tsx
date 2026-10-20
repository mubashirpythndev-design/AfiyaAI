"use client";
import {ShoppingBag,ClipboardList} from "lucide-react";
import {useMarketplace} from "./MarketplaceProvider";
export default function MarketplaceHeaderActions({onBrowse}:{onBrowse?:()=>void}){
  const store=useMarketplace(),count=store.items.reduce((sum,item)=>sum+item.quantity,0);
  return <nav aria-label="Pharmacy marketplace" className="flex items-center justify-between gap-3 border-t border-border py-2 text-sm">
    <button className="inline-flex items-center gap-2" onClick={store.openCart} aria-label={`Smart Cart (${count})`}><ShoppingBag size={18}/><span>Smart Cart</span><span className="text-xs">({count})</span></button>
    <button className="inline-flex items-center gap-2" onClick={store.openOrders}><ClipboardList size={18}/><span>My Orders</span></button>
    <a href="#store-catalog" className="text-xs text-primary" onClick={event=>{if(onBrowse){event.preventDefault();onBrowse();requestAnimationFrame(()=>document.getElementById("store-catalog")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"}));}}}>Browse store</a>
  </nav>;
}
