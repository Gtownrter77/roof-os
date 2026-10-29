'use client'
import { useId } from 'react'
import type { ThemeId, StoryChapter } from '../lib/theme/collection'

type Props = { theme: ThemeId; chapter?: StoryChapter; className?: string }
/** Original vector scenery: no network, timers, sample observations or weather feed. */
export default function ThemeScene({ theme, chapter = 'command', className = '' }: Props) {
  const id = useId().replace(/:/g, '')
  const after = theme === 'after-storm'
  const command = theme === 'storm-command'
  return <div className={`theme-art theme-art-${theme} ${className}`} data-chapter={chapter} aria-hidden="true">
    {theme !== 'professional' && <div className="theme-photo" style={{ backgroundImage: `url(/themes/${theme}.webp)` }} />}
    {theme === 'storm-command' && <><div className="theme-photo-sweep" /><div className="theme-room-lights" /></>}
    <svg className={theme !== 'professional' ? 'theme-vector-layer' : ''} viewBox="0 0 1200 650" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs>
        <linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor={after ? '#253b53' : '#080e1c'} /><stop offset=".6" stopColor={after ? '#c77d50' : theme === 'tornado' ? '#405c53' : '#343a65'} /><stop offset="1" stopColor={after ? '#ffcd87' : '#121b2b'} /></linearGradient>
        <linearGradient id={`${id}-cloud`} x2="0" y2="1"><stop stopColor="#10151e" /><stop offset=".6" stopColor="#202e3b" /><stop offset="1" stopColor="#7d8c91" stopOpacity=".7" /></linearGradient>
        <linearGradient id={`${id}-funnel`}><stop stopColor="#09131b" /><stop offset=".5" stopColor="#657870" /><stop offset=".7" stopColor="#293d36" /><stop offset="1" stopColor="#030911" /></linearGradient>
        <radialGradient id={`${id}-sun`}><stop stopColor="#fff4c9" /><stop offset=".2" stopColor="#ffca7c" stopOpacity=".8" /><stop offset="1" stopColor="#e8934f" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}-radar`}><stop stopColor="#c33091" /><stop offset=".25" stopColor="#ef4b37" /><stop offset=".48" stopColor="#d7bc37" /><stop offset=".7" stopColor="#4eaf55" /><stop offset="1" stopColor="#13563b" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="1200" height="650" fill={`url(#${id}-sky)`} />
      {after && <circle className="theme-sun" cx="870" cy="310" r="310" fill={`url(#${id}-sun)`} />}
      <g className="theme-clouds" fill={`url(#${id}-cloud)`}>
        <path d="M-150 30Q20-80 230 20Q400-70 570 25Q830-100 1020 20Q1210-50 1360 35L1360 180Q1100 150 980 220Q790 145 610 205Q400 130 240 210Q60 130-150 200Z" />
        <path opacity=".8" d="M-160 155Q10 70 240 155Q490 60 710 135Q920 90 1100 145Q1270 100 1390 185L1390 250Q1150 225 970 270Q750 210 580 260Q400 210 210 280Q20 210-160 290Z" />
      </g>
      <g className="theme-bolt" fill="none" stroke="#cad9ff" strokeWidth="4"><path d="M190 160l-25 92 38-12-45 121 65-85-32 5 36-121" /><path d="M1045 145l-31 85 33-9-46 146 71-120-34 3 30-105" /></g>
      {theme === 'tornado' && <g className="theme-funnel">
        <path d="M330 175Q510 155 770 184Q678 243 641 308Q603 377 632 481L588 520Q573 435 529 377Q470 289 330 175Z" fill={`url(#${id}-funnel)`} />
        {Array.from({ length: 12 }, (_, i) => <path key={i} className="theme-vortex-line" d={`M${360+i*19} ${190+i*24}q${230-i*15} ${30-i} ${340-i*27} 3`} fill="none" stroke="#9db3a3" strokeOpacity=".26" strokeWidth={8-i*.5} />)}
        <ellipse className="theme-debris" cx="607" cy="510" rx="145" ry="22" fill="#69766a" opacity=".65" />
        <path className="theme-debris" d="M510 421l18-9m155 43l13 12m-205 35l25 4m210-43l11-9m-154 38l-7 11" stroke="#a0a99c" strokeWidth="5" />
      </g>}
      <path d="M0 490L150 464 270 492 413 471 550 510 700 480 870 502 1040 467 1200 490V650H0Z" fill="#0a121c" />
      <g className="theme-neighborhood" fill={after ? '#2f3440' : '#101a27'} stroke="#7c8a96" strokeWidth="1.2">
        {[15,230,445,695,925,1120].map((x,i) => <g key={x} transform={`translate(${x},${505+(i%2)*22})`}>
          <path d="M0 42L80-20 165 42Z" fill={after ? '#46515d' : '#111a24'} /><path d="M17 42H150V118H17Z" /><path d="M72 66H98V118H72Z" fill="#0c1622" /><path d="M31 61H56V85H31Zm80 0h25v24h-25Z" fill={after ? '#f9c67c' : '#849d98'} />
        </g>)}
      </g>
      {after && <g className="theme-crew" fill="#111e2b" stroke="#e4b780" strokeWidth="2"><path d="M528 545v-58m-15 24l15-24 24 22m-24 36l-11 40m11-40l15 40M560 550v-63m-14 27l14-27 19 22m-19 41l-9 35m9-35l15 35" /><circle cx="528" cy="475" r="10" /><circle cx="560" cy="475" r="10" /><path d="M503 584l48-106 44 106" fill="none" /></g>}
      {command && <g className="theme-command-room">
        <path d="M0 0H1200V650H0Z" fill="#06101d" opacity=".8" />
        <path d="M50 83H1150V460H50Z" fill="#0c2137" stroke="#367694" strokeWidth="3" />
        {[70,430,790].map((x,i) => <g key={x}>
          <path d={`M${x} 105h338v330H${x}Z`} fill="#061727" stroke="#377a9e" strokeWidth="2" />
          <g stroke="#1c566c" strokeWidth="1" fill="none">{[40,85,130].map(r => <circle key={r} cx={x+169} cy="270" r={r} />)}<path d={`M${x} 270h338m-169-165v330`} /></g>
          <ellipse cx={x+180} cy={240+i*30} rx="125" ry="75" transform={`rotate(-35 ${x+180} 270)`} fill={`url(#${id}-radar)`} />
          <path className="theme-radar-sweep" d={`M${x+169} 270l115-90a146 146 0 0 1 29 87Z`} fill="#6be4c5" opacity=".13" style={{ transformOrigin: `${x+169}px 270px` }} />
        </g>)}
        <path d="M20 470H1180L1140 640H60Z" fill="#0b1623" stroke="#45728c" strokeWidth="2" />
        <path d="M140 500H320L300 551H120Zm680 0h200l20 51H840Z" fill="#183a50" stroke="#428ba8" />
        <g className="theme-meteorologist">
          <path d="M485 645L503 374Q550 342 601 365L624 458 746 354 762 377 626 519 591 469 601 645Z" fill="#263847" stroke="#78949e" strokeWidth="2" />
          <path d="M538 358l16 88 28-86" fill="#d9e5e2" /><path d="M553 379l11-4 9 62-11 16-8-16Z" fill="#da333d" />
          <ellipse cx="559" cy="318" rx="32" ry="42" fill="#c6a18c" /><path d="M527 315q-5-54 38-45 35 1 26 48l-12-27-36 3Z" fill="#1e2530" />
          <path d="M744 357l22-21 15 3-19 38Z" fill="#c6a18c" />
        </g>
        <rect x="50" y="31" width="494" height="42" fill="#c22235" /><text x="70" y="60" fill="white" fontSize="25" fontWeight="900" fontFamily="Arial">STORM TRACKER 11</text>
        <text x="820" y="61" fill="#73d9ff" fontSize="15" letterSpacing="4" fontFamily="Arial">COMMAND CENTER</text>
      </g>}
      {theme === 'professional' && <g fill="none" stroke="#ef3340" strokeWidth="3" opacity=".8"><path d="M200 440L600 140 1000 440M275 430V570H925V430" /><path d="M310 420L600 205 890 420" opacity=".4" /></g>}
    </svg>
    {(theme === 'hail' || theme === 'tornado') && <div className="theme-precipitation">{Array.from({ length: 24 }, (_,i) => <i key={i} style={{ left: `${(i*41)%100}%`, animationDelay: `${-(i*.37)}s`, animationDuration: `${.8+(i%5)*.18}s` }} />)}</div>}
    <div className="theme-art-shade" />
  </div>
}
