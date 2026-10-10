export function Emblem({ small = false }: {small?: boolean}) {
 return <svg className={small ? 'emblem small' : 'emblem'} viewBox="0 0 240 200" aria-hidden="true">
 <g fill="none" stroke="currentColor"><circle cx="120" cy="99" r="70" opacity=".15"/><circle cx="120" cy="99" r="52" strokeDasharray="2 9" opacity=".4"/>
 <path d="M120 14v17m0 136v17M35 99h17m136 0h17M60 39l12 12m96 96 12 12M60 159l12-12m96-96 12-12" opacity=".4"/>
 <path d="m120 44 46 27v54l-46 27-46-27V71Z" strokeWidth="2"/><path d="m120 63 19 36-19 35-19-35Z" strokeWidth="2"/>
 <path d="m120 63 19 36-19 8Z" fill="currentColor" opacity=".7"/><path d="m101 99 19 35v-27Z" fill="currentColor" opacity=".2"/>
 <circle cx="39" cy="151" r="4" fill="currentColor"/><circle cx="199" cy="49" r="4" fill="currentColor"/><path d="m39 147 17-31m126-39 13-24" opacity=".25"/>
 </g></svg>;
}
