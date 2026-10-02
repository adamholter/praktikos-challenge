import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Praktikos | The challenge',description:'A playable browser recreation of BitHammer Studios’ tactical card roguelike. Choose your sin. Take the throne.',metadataBase:new URL('https://praktikos-challenge.adamholter.chatgpt.site'),twitter:{card:'summary_large_image',images:['/og.png']},openGraph:{images:[{url:'/og.png',width:1280,height:720}],title:'Praktikos | The challenge',description:'Choose your sin. Build your deck. Take the throne.'}};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
