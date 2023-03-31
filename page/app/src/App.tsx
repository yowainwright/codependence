import React, { useEffect, useState } from 'react'
import { Drawer } from './components/Drawer'
import { Docs } from './components/Docs'
import { NavBar } from './components/NavBar'
import Introduction from './content/introduction.mdx'
import Footer from './content/footer.mdx'

export function App() {
  const [isOpen, setIsOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const root = document.documentElement
    const currentTheme = root.getAttribute('data-theme')
    if (currentTheme && currentTheme === theme) return
    root.setAttribute('data-theme', theme)
  }, [theme])

  const toggleDrawer = () => setIsOpen(!isOpen)
  const toggleTheme = () => {
    const updatedTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(updatedTheme)
  }

  return (
    <main className='App main'>
      <Drawer isOpen={isOpen} toggleDrawer={toggleDrawer}>
        <NavBar isOpen={isOpen} toggleDrawer={toggleDrawer} toggleTheme={toggleTheme} />
        <Docs Component={Introduction} />
        <Docs Component={Footer} />
      </Drawer>
    </main>
  )
}

export default App
