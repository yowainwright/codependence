import{j as t}from"./jsx-runtime.u17CrQMm.js";import{r as c}from"./index.saqyeS7l.js";const u=[{id:"policy",title:"Policy",lines:[{text:"$ ",color:"text-secondary"},{text:"codependence --dryRun --format table",color:"text-base-content"},{text:`

`,color:""},{text:"Policy: ",color:"text-base-content/70"},{text:".codependencerc",color:"text-primary"},{text:`
Strategy: `,color:"text-base-content/70"},{text:"permissive",color:"text-accent"},{text:" (pin listed, update the rest)",color:"text-base-content/50"},{text:`
Files: `,color:"text-base-content/70"},{text:"package.json packages/*/package.json",color:"text-info"},{text:`

`,color:""},{text:"No files changed in dry run",color:"text-success"}]},{id:"config",title:"Config",lines:[{text:"// .codependencerc",color:"text-base-content/50"},{text:`
`,color:""},{text:"{",color:"text-base-content"},{text:`
  `,color:""},{text:'"permissive"',color:"text-primary"},{text:": ",color:"text-base-content"},{text:"true",color:"text-secondary"},{text:",",color:"text-base-content"},{text:`
  `,color:""},{text:'"codependencies"',color:"text-primary"},{text:": [",color:"text-base-content"},{text:`
    `,color:""},{text:"{ ",color:"text-base-content"},{text:'"react"',color:"text-primary"},{text:": ",color:"text-base-content"},{text:'"^18.3.1"',color:"text-success"},{text:" },",color:"text-base-content"},{text:`
    `,color:""},{text:"{ ",color:"text-base-content"},{text:'"typescript"',color:"text-primary"},{text:": ",color:"text-base-content"},{text:'"^5.9.3"',color:"text-success"},{text:" }",color:"text-base-content"},{text:`
  ],`,color:"text-base-content"},{text:`
  `,color:""},{text:'"files"',color:"text-primary"},{text:': ["package.json", "packages/*/package.json"]',color:"text-base-content"},{text:`
}`,color:"text-base-content"}]},{id:"check",title:"CI Check",lines:[{text:"$ ",color:"text-secondary"},{text:"codependence",color:"text-base-content"},{text:`

`,color:""},{text:"Found 2 dependency issues",color:"text-warning"},{text:`
`,color:""},{text:"1. react: found 19.0.0, expected ^18.3.1",color:"text-base-content"},{text:`
`,color:""},{text:"2. typescript: found 5.7.0, expected ^5.9.3",color:"text-base-content"},{text:`
`,color:""},{text:`
`,color:""},{text:"Dependencies are not correct.",color:"text-error"},{text:`
`,color:""},{text:`
CI result: `,color:"text-base-content/70"},{text:"fail on drift",color:"text-error"}]},{id:"apply",title:"Apply",lines:[{text:"$ ",color:"text-secondary"},{text:"codependence --update",color:"text-base-content"},{text:`

`,color:""},{text:"Applying version policy...",color:"text-base-content/70"},{text:`

`,color:""},{text:"react ",color:"text-base-content"},{text:"19.0.0",color:"text-warning"},{text:" -> ",color:"text-base-content/50"},{text:"^18.3.1",color:"text-success"},{text:`
`,color:""},{text:"typescript ",color:"text-base-content"},{text:"5.7.0",color:"text-warning"},{text:" -> ",color:"text-base-content/50"},{text:"^5.9.3",color:"text-success"},{text:`
`,color:""},{text:`

`,color:""},{text:"Updated ",color:"text-success"},{text:"2",color:"text-accent"},{text:" dependencies in ",color:"text-base-content"},{text:"package.json",color:"text-info"}]}],k=12,T=2500;function A(){const[l,b]=c.useState(0),[s,x]=c.useState(0),[m,f]=c.useState(!0),a=c.useRef(null),h=c.useRef(!1),i=u[l],d=i.lines.map(e=>e.text).join("").length;c.useEffect(()=>{const e=new IntersectionObserver(o=>{o[0]?.isIntersecting&&!h.current&&(h.current=!0,f(!0))},{threshold:.3});return a.current&&e.observe(a.current),()=>e.disconnect()},[]),c.useEffect(()=>{if(!m)return;if(s<d){const o=setTimeout(()=>{x(n=>n+1)},k);return()=>clearTimeout(o)}const e=setTimeout(()=>{const o=(l+1)%u.length;b(o),x(0)},T);return()=>clearTimeout(e)},[s,d,m,l]);const y=e=>{b(e),x(0),f(!0)},v=u.map((e,o)=>{const n=l===o;return t.jsx("button",{onClick:()=>y(o),className:`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${n?"bg-primary/20 text-primary":"text-base-content/50 hover:text-base-content/80 hover:bg-base-content/5"}`,children:e.title},e.id)}),j=()=>{let e=0;const o=[];for(let n=0;n<i.lines.length;n++){const r=i.lines[n],p=e,g=e+r.text.length;if(p>=s)break;const N=Math.min(s-p,r.text.length),w=r.text.slice(0,N);o.push(t.jsx("span",{className:r.color||"text-base-content",children:w},n)),e=g}return o},C=s>=d;return t.jsx("div",{ref:a,className:"w-full max-w-3xl xl:w-[48rem] mt-10 xl:mt-0",children:t.jsxs("div",{className:"relative overflow-hidden rounded-xl border border-base-content/10 shadow-2xl",children:[t.jsx("div",{className:"absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-secondary/20 rounded-xl blur-xl opacity-50"}),t.jsxs("div",{className:"relative",children:[t.jsxs("div",{className:"bg-base-200 px-4 py-3 flex items-center justify-between",children:[t.jsxs("div",{className:"flex gap-2",children:[t.jsx("div",{className:"w-3 h-3 rounded-full bg-error/80"}),t.jsx("div",{className:"w-3 h-3 rounded-full bg-warning/80"}),t.jsx("div",{className:"w-3 h-3 rounded-full bg-success/80"})]}),t.jsx("div",{className:"flex gap-1",children:v}),t.jsx("div",{className:"w-[52px]"})]}),t.jsx("div",{className:"bg-base-300/80 backdrop-blur-sm p-6 min-h-[320px]",children:t.jsx("pre",{className:"text-sm font-mono leading-relaxed",children:t.jsxs("code",{children:[j(),!C&&t.jsx("span",{className:"inline-block w-2 h-4 ml-0.5 bg-primary animate-pulse"})]})})})]})]})})}export{A as default};
