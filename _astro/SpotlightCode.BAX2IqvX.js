import{r as e,t}from"./react.C1VktWof.js";import{t as n}from"./jsx-runtime._2bRE77D.js";var r=e(t(),1),i=n(),a=[{id:`policy`,title:`Policy`,lines:[{text:`$ `,color:`text-secondary`},{text:`codependence --dryRun --format table`,color:`text-base-content`},{text:`

`,color:``},{text:`Policy: `,color:`text-base-content/70`},{text:`.codependencerc`,color:`text-primary`},{text:`
Strategy: `,color:`text-base-content/70`},{text:`permissive`,color:`text-accent`},{text:` (pin listed, update the rest)`,color:`text-base-content/50`},{text:`
Files: `,color:`text-base-content/70`},{text:`package.json packages/*/package.json`,color:`text-info`},{text:`

`,color:``},{text:`No files changed in dry run`,color:`text-success`}]},{id:`config`,title:`Config`,lines:[{text:`// .codependencerc`,color:`text-base-content/50`},{text:`
`,color:``},{text:`{`,color:`text-base-content`},{text:`
  `,color:``},{text:`"permissive"`,color:`text-primary`},{text:`: `,color:`text-base-content`},{text:`true`,color:`text-secondary`},{text:`,`,color:`text-base-content`},{text:`
  `,color:``},{text:`"codependencies"`,color:`text-primary`},{text:`: [`,color:`text-base-content`},{text:`
    `,color:``},{text:`{ `,color:`text-base-content`},{text:`"react"`,color:`text-primary`},{text:`: `,color:`text-base-content`},{text:`"^18.3.1"`,color:`text-success`},{text:` },`,color:`text-base-content`},{text:`
    `,color:``},{text:`{ `,color:`text-base-content`},{text:`"typescript"`,color:`text-primary`},{text:`: `,color:`text-base-content`},{text:`"^5.9.3"`,color:`text-success`},{text:` }`,color:`text-base-content`},{text:`
  ],`,color:`text-base-content`},{text:`
  `,color:``},{text:`"files"`,color:`text-primary`},{text:`: ["package.json", "packages/*/package.json"]`,color:`text-base-content`},{text:`
}`,color:`text-base-content`}]},{id:`check`,title:`CI Check`,lines:[{text:`$ `,color:`text-secondary`},{text:`codependence`,color:`text-base-content`},{text:`

`,color:``},{text:`Found 2 dependency issues`,color:`text-warning`},{text:`
`,color:``},{text:`1. react: found 19.0.0, expected ^18.3.1`,color:`text-base-content`},{text:`
`,color:``},{text:`2. typescript: found 5.7.0, expected ^5.9.3`,color:`text-base-content`},{text:`
`,color:``},{text:`
`,color:``},{text:`Dependencies are not correct.`,color:`text-error`},{text:`
`,color:``},{text:`
CI result: `,color:`text-base-content/70`},{text:`fail on drift`,color:`text-error`}]},{id:`apply`,title:`Apply`,lines:[{text:`$ `,color:`text-secondary`},{text:`codependence --update`,color:`text-base-content`},{text:`

`,color:``},{text:`Applying version policy...`,color:`text-base-content/70`},{text:`

`,color:``},{text:`react `,color:`text-base-content`},{text:`19.0.0`,color:`text-warning`},{text:` -> `,color:`text-base-content/50`},{text:`^18.3.1`,color:`text-success`},{text:`
`,color:``},{text:`typescript `,color:`text-base-content`},{text:`5.7.0`,color:`text-warning`},{text:` -> `,color:`text-base-content/50`},{text:`^5.9.3`,color:`text-success`},{text:`
`,color:``},{text:`

`,color:``},{text:`Updated `,color:`text-success`},{text:`2`,color:`text-accent`},{text:` dependencies in `,color:`text-base-content`},{text:`package.json`,color:`text-info`}]}],o=12,s=2500;function c(){let[e,t]=(0,r.useState)(0),[n,c]=(0,r.useState)(0),[l,u]=(0,r.useState)(!0),d=(0,r.useRef)(null),f=(0,r.useRef)(!1),p=a[e],m=p.lines.map(e=>e.text).join(``).length;(0,r.useEffect)(()=>{let e=new IntersectionObserver(e=>{e[0]?.isIntersecting&&!f.current&&(f.current=!0,u(!0))},{threshold:.3});return d.current&&e.observe(d.current),()=>e.disconnect()},[]),(0,r.useEffect)(()=>{if(!l)return;if(n<m){let e=setTimeout(()=>{c(e=>e+1)},o);return()=>clearTimeout(e)}let r=setTimeout(()=>{let n=(e+1)%a.length;t(n),c(0)},s);return()=>clearTimeout(r)},[n,m,l,e]);let h=e=>{t(e),c(0),u(!0)},g=a.map((t,n)=>(0,i.jsx)(`button`,{onClick:()=>h(n),className:`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${e===n?`bg-primary/20 text-primary`:`text-base-content/50 hover:text-base-content/80 hover:bg-base-content/5`}`,children:t.title},t.id)),_=()=>{let e=0,t=[];for(let r=0;r<p.lines.length;r++){let a=p.lines[r],o=e,s=e+a.text.length;if(o>=n)break;let c=Math.min(n-o,a.text.length),l=a.text.slice(0,c);t.push((0,i.jsx)(`span`,{className:a.color||`text-base-content`,children:l},r)),e=s}return t},v=n>=m;return(0,i.jsx)(`div`,{ref:d,className:`w-full max-w-3xl xl:w-[48rem] mt-10 xl:mt-0`,children:(0,i.jsxs)(`div`,{className:`relative overflow-hidden rounded-xl border border-base-content/10 shadow-2xl`,children:[(0,i.jsx)(`div`,{className:`absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-secondary/20 rounded-xl blur-xl opacity-50`}),(0,i.jsxs)(`div`,{className:`relative`,children:[(0,i.jsxs)(`div`,{className:`bg-base-200 px-4 py-3 flex items-center justify-between`,children:[(0,i.jsxs)(`div`,{className:`flex gap-2`,children:[(0,i.jsx)(`div`,{className:`w-3 h-3 rounded-full bg-error/80`}),(0,i.jsx)(`div`,{className:`w-3 h-3 rounded-full bg-warning/80`}),(0,i.jsx)(`div`,{className:`w-3 h-3 rounded-full bg-success/80`})]}),(0,i.jsx)(`div`,{className:`flex gap-1`,children:g}),(0,i.jsx)(`div`,{className:`w-[52px]`})]}),(0,i.jsx)(`div`,{className:`bg-base-300/80 backdrop-blur-sm p-6 min-h-[320px]`,children:(0,i.jsx)(`pre`,{className:`text-sm font-mono leading-relaxed`,children:(0,i.jsxs)(`code`,{children:[_(),!v&&(0,i.jsx)(`span`,{className:`inline-block w-2 h-4 ml-0.5 bg-primary animate-pulse`})]})})})]})]})})}export{c as default};