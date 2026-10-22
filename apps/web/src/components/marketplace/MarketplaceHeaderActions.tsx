"use client";
import {ShoppingBag,ClipboardList,Store,ArrowUpRight} from "lucide-react";
import {useMarketplace} from "./MarketplaceProvider";
export default function MarketplaceHeaderActions({onBrowse}:{onBrowse?:()=>void}) {
  const store=useMarketplace(),count=store.items.reduce((sum,item)=>sum+item.quantity,0);
  return <nav aria-label="Pharmacy marketplace" className="market-nav">
    <a href="#store-catalog" className="market-nav-store" onClick={event=>{if(onBrowse){event.preventDefault();onBrowse();requestAnimationFrame(()=>document.getElementById("store-catalog")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"}));}}}><span className="market-nav-symbol"><Store size={17}/></span><span>Pharmacy store<small>{store.catalog.some(item=>item.is_demo_seller)?"Demo store / no real fulfillment":"Browse medicines & prices"}</small></span><ArrowUpRight size={15}/></a>
    <div className="market-nav-actions"><button onClick={store.openOrders}><ClipboardList size={17}/><span>My orders</span></button><button className="market-nav-cart" onClick={store.openCart} aria-label={`Smart Cart (${count})`}><ShoppingBag size={17}/><span>Smart cart</span><span className="market-cart-count" aria-hidden="true">{count}</span></button></div>
  </nav>;
}
