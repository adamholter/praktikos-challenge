'use client';
import { useEffect, useRef } from 'react';
export default function Home() {
 const host = useRef<HTMLDivElement>(null);
 useEffect(() => { let dispose: (()=>void)|undefined; let alive=true; import('../src/game.js').then(({mountGame})=>{ if(alive&&host.current) dispose=mountGame(host.current); }); return()=>{alive=false;dispose?.();}; }, []);
 return <main ref={host} id="game-root" aria-label="Praktikos card game"><div className="loading">PRAKTIKOS<span>Entering the Underworld...</span></div></main>;
}
