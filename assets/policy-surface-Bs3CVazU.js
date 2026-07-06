import{p as e}from"./index-DzNaZBY9.js";var t=e();function n(e){let n={code:`code`,h2:`h2`,li:`li`,p:`p`,ul:`ul`,...e.components};return(0,t.jsxs)(`section`,{children:[(0,t.jsx)(n.h2,{id:`policy-surface`,children:`Policy Surface`}),(0,t.jsx)(n.p,{children:`Codependence is strongest when it treats versions as project policy. Some
surfaces are supported today; others are roadmap targets that should stay
clearly marked until implemented.`}),(0,t.jsx)(n.h2,{id:`supported-today`,children:`Supported Today`}),(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`package.json`}),` dependency sections for Node.js projects`]}),`
`,(0,t.jsxs)(n.li,{children:[`Root and child package `,(0,t.jsx)(n.code,{children:`codependence`}),` config in monorepos`]}),`
`,(0,t.jsx)(n.li,{children:`Check-only, dry-run, interactive, and update modes`}),`
`,(0,t.jsx)(n.li,{children:`Patch, minor, or major update limits`}),`
`,(0,t.jsx)(n.li,{children:`Table, JSON, and Markdown output for scripts and CI`}),`
`,(0,t.jsx)(n.li,{children:`Experimental Python, Go, and Rust manifest checks`}),`
`,(0,t.jsx)(n.li,{children:`Experimental Dockerfile checks`}),`
`,(0,t.jsx)(n.li,{children:`Experimental GitHub Actions workflow checks`}),`
`]}),(0,t.jsx)(n.h2,{id:`good-next-targets`,children:`Good Next Targets`}),(0,t.jsx)(n.p,{children:`These are natural extensions of the same policy model:`}),(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`Local repository scan: report version drift across a directory such as `,(0,t.jsx)(n.code,{children:`~/code`})]}),`
`,(0,t.jsxs)(n.li,{children:[`Toolchain files: `,(0,t.jsx)(n.code,{children:`.nvmrc`}),`, `,(0,t.jsx)(n.code,{children:`.node-version`}),`, `,(0,t.jsx)(n.code,{children:`.tool-versions`}),`, and `,(0,t.jsx)(n.code,{children:`.mise.toml`})]}),`
`,(0,t.jsxs)(n.li,{children:[`Container files beyond `,(0,t.jsx)(n.code,{children:`Dockerfile`}),`: `,(0,t.jsx)(n.code,{children:`Containerfile`}),` and compose image tags`]}),`
`,(0,t.jsx)(n.li,{children:`CI workflow files beyond GitHub Actions: GitLab CI, CircleCI, and similar YAML`}),`
`,(0,t.jsxs)(n.li,{children:[`Runtime images: `,(0,t.jsx)(n.code,{children:`node`}),`, `,(0,t.jsx)(n.code,{children:`bun`}),`, `,(0,t.jsx)(n.code,{children:`python`}),`, `,(0,t.jsx)(n.code,{children:`golang`}),`, `,(0,t.jsx)(n.code,{children:`ubuntu`}),`, and other common base images`]}),`
`]}),(0,t.jsx)(n.h2,{id:`product-boundary`,children:`Product Boundary`}),(0,t.jsx)(n.p,{children:`Dependabot and Renovate are good at hosted update PR automation. Codependence
should stay focused on local and CI policy enforcement:`}),(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`detect drift`}),`
`,(0,t.jsx)(n.li,{children:`report drift`}),`
`,(0,t.jsx)(n.li,{children:`optionally apply policy`}),`
`,(0,t.jsx)(n.li,{children:`work outside a hosted bot workflow`}),`
`]}),(0,t.jsx)(n.p,{children:`That keeps the project useful without competing directly with tools that already
handle broad dependency automation well.`})]})}function r(e={}){let{wrapper:r}=e.components||{};return r?(0,t.jsx)(r,{...e,children:(0,t.jsx)(n,{...e})}):n(e)}export{r as default};