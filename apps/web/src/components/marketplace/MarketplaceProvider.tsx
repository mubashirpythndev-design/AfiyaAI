"use client";
import {createContext,useContext,useState,useEffect,useCallback,useRef,type ReactNode} from "react";
import {useClerk,useUser} from "@clerk/nextjs";
import {fetchStoreCatalog,type StoreCartItem,type StoreCatalogItem} from "@/lib/api";
import {isLoggedIn} from "@/lib/auth";
import {errorMessage} from "@/lib/marketplace";
import SmartCartDrawer from "./SmartCartDrawer";
import MyOrdersDrawer from "./MyOrdersDrawer";
import ConciergeRxModal from "./ConciergeRxModal";

interface MarketplaceState {
  catalog:StoreCatalogItem[]; catalogError:string|null; catalogLoading:boolean; refreshCatalog:()=>Promise<void>;
  items:StoreCartItem[]; setItems:React.Dispatch<React.SetStateAction<StoreCartItem[]>>;
  attachment:File|null; setAttachment:(file:File|null)=>void;
  addItems:(items:StoreCartItem[],file?:File|null)=>void;
  openCart:()=>void; openOrders:()=>void; openConcierge:(file?:File|null)=>void; requireAuth:()=>boolean;
}
const Context=createContext<MarketplaceState|null>(null);
export function useMarketplace() {const value=useContext(Context);if(!value)throw new Error("Marketplace provider missing");return value;}
export default function MarketplaceProvider({children}:{children:ReactNode}) {
  const {isSignedIn,user}=useUser();const clerk=useClerk();
  const [catalog,setCatalog]=useState<StoreCatalogItem[]>([]),[catalogError,setCatalogError]=useState<string|null>(null),[catalogLoading,setCatalogLoading]=useState(false);
  const [items,setItems]=useState<StoreCartItem[]>([]),[attachment,setAttachment]=useState<File|null>(null);
  const [cartOpen,setCartOpen]=useState(false),[ordersOpen,setOrdersOpen]=useState(false),[conciergeOpen,setConciergeOpen]=useState(false);
  const previousUser=useRef<string|null|undefined>(undefined);
  useEffect(()=>{const id=user?.id??null;if(previousUser.current&&previousUser.current!==id){setItems([]);setAttachment(null);setCartOpen(false);setOrdersOpen(false);setConciergeOpen(false);}previousUser.current=id;},[user?.id]);
  const refreshCatalog=useCallback(async()=>{setCatalogLoading(true);try{setCatalog(await fetchStoreCatalog());setCatalogError(null);}catch(error){setCatalogError(errorMessage(error));}finally{setCatalogLoading(false);}},[]);
  useEffect(()=>{void refreshCatalog();},[refreshCatalog]);
  const requireAuth=()=>{if(isSignedIn||isLoggedIn())return true;setCartOpen(false);setOrdersOpen(false);setConciergeOpen(false);clerk.openSignIn();return false;};
  function addItems(incoming:StoreCartItem[],file?:File|null) {
    setItems(current=>{const result=current.map(item=>({...item}));for(const item of incoming){const old=result.find(row=>row.medicine_id===item.medicine_id);if(old)old.quantity=Math.min(10000,old.quantity+item.quantity);else result.push(item);}return result;});
    if(file)setAttachment(file);setCartOpen(true);
  }
  return <Context.Provider value={{catalog,catalogError,catalogLoading,refreshCatalog,items,setItems,attachment,setAttachment,addItems,
    openCart:()=>setCartOpen(true),openOrders:()=>{if(requireAuth())setOrdersOpen(true);},openConcierge:(file)=>{if(file)setAttachment(file);setConciergeOpen(true);},requireAuth}}>
    {children}
    <SmartCartDrawer key={`cart-${user?.id??"guest"}`} isOpen={cartOpen} onClose={()=>setCartOpen(false)}/>
    <MyOrdersDrawer key={`orders-${user?.id??"guest"}`} isOpen={ordersOpen} onClose={()=>setOrdersOpen(false)}/>
    <ConciergeRxModal key={`concierge-${user?.id??"guest"}`} isOpen={conciergeOpen} onClose={()=>setConciergeOpen(false)} onSent={()=>{setConciergeOpen(false);setOrdersOpen(true);}}/>
  </Context.Provider>;
}
