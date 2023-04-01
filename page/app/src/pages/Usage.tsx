import React from 'react'
import { Docs } from '../components/Docs'
import Badges from '../content/badges.mdx'

import Usage from '../content/usage.mdx'
import Footer from '../content/footer.mdx'

export const BasicUsage = () => (
  <>
    <Docs Component={Badges} />
    <Docs Component={Usage} />
    <Docs Component={Footer} />
  </>
)
