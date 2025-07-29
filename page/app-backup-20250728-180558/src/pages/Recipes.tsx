import React from "react";
import { Docs } from "../components/Docs";
import Badges from "../content/badges.mdx";

import Recipes from "../content/recipes.mdx";
import Footer from "../content/footer.mdx";

export const BasicRecipes = () => (
  <>
    <Docs Component={Badges} />
    <Docs Component={Recipes} />
    <Docs Component={Footer} />
  </>
);
