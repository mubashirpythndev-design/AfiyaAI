"use client";
import {useEffect,useRef} from "react";

/** Decorative reading progress. No network calls or scroll data storage. */
export default function ScrollProgress() {
  const bar=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    let frame=0;
    const update=()=>{
      frame=0;
      const total=document.documentElement.scrollHeight-window.innerHeight;
      const value=total>0?Math.max(0,Math.min(1,window.scrollY/total)):0;
      if(bar.current)bar.current.style.transform=`scaleX(${value})`;
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
    const observer=new ResizeObserver(schedule);
    observer.observe(document.body);
    window.addEventListener("scroll",schedule,{passive:true});
    window.addEventListener("resize",schedule);
    update();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener("scroll",schedule);window.removeEventListener("resize",schedule);};
  },[]);
  return <div className="scroll-progress-track" aria-hidden="true"><div ref={bar} className="scroll-progress-fill"/></div>;
}
