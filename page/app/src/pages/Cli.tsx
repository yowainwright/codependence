import React from 'react'
import { Docs } from '../components/Docs'
import Badges from '../content/badges.mdx'

import Usage from '../content/cli.mdx'
import Footer from '../content/footer.mdx'

export const Cli = () => (
  <>
    <Docs Component={Badges} />
    <Docs Component={Usage} />
    <Docs Component={Footer} />
  </>
)
