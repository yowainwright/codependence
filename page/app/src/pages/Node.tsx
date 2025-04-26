import React from 'react'
import { Docs } from '../components/Docs'
import Badges from '../content/badges.mdx'

import Node from '../content/node.mdx'
import Footer from '../content/footer.mdx'

export const BasicNode = () => (
  <>
    <Docs Component={Badges} />
    <Docs Component={Node} />
    <Docs Component={Footer} />
  </>
)
