import React, { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Drawer } from './components/Drawer'
import { Home } from './pages/Home'
import { BasicUsage as Usage } from './pages/Usage'
import { Cli } from './pages/Cli'
import { BasicNode as Node } from './pages/Node'
import { BasicOptions as Options } from './pages/Options'
import { BasicRecipes as Recipes } from './pages/Recipes'
import { NavBar } from './components/NavBar'

export function App() {
  const [isOpen, setIsOpen] = useState(false)
  const [theme, setTheme] = useState<'cupcake' | 'night'>('cupcake')

  useEffect(() => {
    const root = document.documentElement
    const currentTheme = root.getAttribute('data-theme')
    if (currentTheme && currentTheme === theme) return
    root.setAttribute('data-theme', theme)
  }, [theme])

  const toggleDrawer = () => setIsOpen(!isOpen)
  const toggleTheme = () => {
    const updatedTheme = theme === 'cupcake' ? 'night' : 'cupcake'
    setTheme(updatedTheme)
  }

  return (
    <main className='App main'>
      <Drawer isOpen={isOpen} toggleDrawer={toggleDrawer}>
        <NavBar isOpen={isOpen} toggleDrawer={toggleDrawer} toggleTheme={toggleTheme} />
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/usage/' element={<Usage />} />
          <Route path='/cli/' element={<Cli />} />
          <Route path='/node/' element={<Node />} />
          <Route path='/options/' element={<Options />} />
          <Route path='/recipes/' element={<Recipes />} />
        </Routes>
      </Drawer>
    </main>
  )
}

export default App
