import{j as t}from"./jsx-runtime.D_zvdyIk.js";import{r as s}from"./index.BJfUAbRs.js";const l=[{id:"init",lines:[{text:"$ ",color:"text-primary"},{text:"npx codependence init",color:"text-base-content"},{text:`

`,color:""},{text:"Creating .codependencerc...",color:"text-base-content/70"},{text:`
`,color:""},{text:"✓",color:"text-success"},{text:" Configuration file created",color:"text-base-content"}]},{id:"config",lines:[{text:"// .codependencerc",color:"text-base-content/50"},{text:`
{
  `,color:"text-base-content"},{text:'"codependencies"',color:"text-primary"},{text:`: {
    `,color:"text-base-content"},{text:'"react"',color:"text-primary"},{text:": ",color:"text-base-content"},{text:'"^18.0.0"',color:"text-success"},{text:`,
    `,color:"text-base-content"},{text:'"typescript"',color:"text-primary"},{text:": ",color:"text-base-content"},{text:'"^5.0.0"',color:"text-success"},{text:`,
    `,color:"text-base-content"},{text:'"eslint"',color:"text-primary"},{text:": ",color:"text-base-content"},{text:'"^8.0.0"',color:"text-success"},{text:`,
    `,color:"text-base-content"},{text:'"prettier"',color:"text-primary"},{text:": ",color:"text-base-content"},{text:'"^3.0.0"',color:"text-success"},{text:`
  }
}`,color:"text-base-content"}]},{id:"check",lines:[{text:"$ ",color:"text-primary"},{text:"npx codependence",color:"text-base-content"},{text:`

`,color:""},{text:"Checking codependencies...",color:"text-base-content/70"},{text:`
`,color:""},{text:"✓",color:"text-success"},{text:" react@",color:"text-base-content"},{text:"18.2.0",color:"text-info"},{text:" matches ",color:"text-base-content"},{text:"^18.0.0",color:"text-success"},{text:`
`,color:""},{text:"✓",color:"text-success"},{text:" typescript@",color:"text-base-content"},{text:"5.3.3",color:"text-info"},{text:" matches ",color:"text-base-content"},{text:"^5.0.0",color:"text-success"},{text:`
`,color:""},{text:"✗",color:"text-error"},{text:" eslint@",color:"text-base-content"},{text:"7.32.0",color:"text-info"},{text:" does not match ",color:"text-base-content"},{text:"^8.0.0",color:"text-error"},{text:`
`,color:""},{text:"✗",color:"text-error"},{text:" prettier@",color:"text-base-content"},{text:"2.8.8",color:"text-info"},{text:" does not match ",color:"text-base-content"},{text:"^3.0.0",color:"text-error"}]},{id:"update",lines:[{text:"$ ",color:"text-primary"},{text:"npx codependence --update",color:"text-base-content"},{text:`

`,color:""},{text:"Updating mismatched dependencies...",color:"text-base-content/70"},{text:`
`,color:""},{text:"⟳",color:"text-info"},{text:" Updating ",color:"text-base-content"},{text:"eslint",color:"text-warning"},{text:" from ",color:"text-base-content"},{text:"7.32.0",color:"text-error"},{text:" to ",color:"text-base-content"},{text:"8.57.0",color:"text-success"},{text:"...",color:"text-base-content/70"},{text:`
`,color:""},{text:"⟳",color:"text-info"},{text:" Updating ",color:"text-base-content"},{text:"prettier",color:"text-warning"},{text:" from ",color:"text-base-content"},{text:"2.8.8",color:"text-error"},{text:" to ",color:"text-base-content"},{text:"3.2.5",color:"text-success"},{text:"...",color:"text-base-content/70"},{text:`
`,color:""},{text:"✓",color:"text-success"},{text:" All codependencies updated successfully!",color:"text-base-content"}]}];function d(){const[o,r]=s.useState(0);return t.jsx("div",{className:"w-full max-w-3xl mt-10 xl:mt-0",children:t.jsxs("div",{className:"relative overflow-hidden rounded-lg border border-base-content/20",children:[t.jsx("div",{className:"bg-base-300 px-4 py-3 flex items-center gap-2",children:t.jsxs("div",{className:"flex gap-2",children:[t.jsx("div",{className:"w-3 h-3 rounded-full bg-red-500"}),t.jsx("div",{className:"w-3 h-3 rounded-full bg-yellow-500"}),t.jsx("div",{className:"w-3 h-3 rounded-full bg-green-500"})]})}),t.jsx("div",{className:"bg-base-300 p-6 space-y-6 min-h-[500px]",children:l.map((c,e)=>t.jsxs("div",{onMouseEnter:()=>r(e),className:"relative cursor-pointer",children:[t.jsx("div",{className:`absolute -inset-2 transition-opacity duration-300 ${o===e?"opacity-100":"opacity-0"}`,style:{background:"radial-gradient(circle at center, hsl(var(--p) / 0.05), transparent 70%)"}}),t.jsx("pre",{className:"text-sm font-mono relative",children:t.jsx("code",{children:c.lines.map((n,x)=>t.jsx("span",{className:`transition-all duration-300 ${o===e?n.color||"text-base-content":"text-base-content/40"}`,children:n.text},x))})})]},c.id))})]})})}export{d as default};
