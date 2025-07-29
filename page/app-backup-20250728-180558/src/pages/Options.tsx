import React from "react";
import { Docs } from "../components/Docs";
import Badges from "../content/badges.mdx";

import Options from "../content/options.mdx";
import Footer from "../content/footer.mdx";

export const BasicOptions = () => (
  <>
    <Docs Component={Badges} />
    <Docs Component={Options} />
    <Docs Component={Footer} />
  </>
);
