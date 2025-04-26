import React from 'react'
import { Docs } from '../components/Docs'
import Badges from '../content/badges.mdx'
import Introduction from '../content/introduction.mdx'
import MainUsecase from '../content/main-usecase.mdx'
import Synopsis from '../content/synopsis.mdx'
import WhyUseCodependence from '../content/why-use-codependence.mdx'
import WhyNotUseCodependence from '../content/why-not-use-codependence.mdx'
import Footer from '../content/footer.mdx'

export const Home = () => (
  <>
    <Docs Component={Badges} />
    <Docs Component={Introduction} />
    <Docs Component={MainUsecase} />
    <Docs Component={Synopsis} />
    <Docs Component={WhyUseCodependence} />
    <Docs Component={WhyNotUseCodependence} />
    <Docs Component={Footer} />
  </>
)
