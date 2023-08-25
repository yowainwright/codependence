import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Collapse, Divider, Menu } from 'react-daisyui'

export const SideBar = () => {
  const [isOpenDeadSimple, setIsOpenDeadSimple] = useState(true)
  const onToggleDeadSimple = () => setIsOpenDeadSimple(!isOpenDeadSimple)
  return (
    <aside className='sidebar menu p-4 w-80 bg-base-100 text-base-content bg-base-200'>
      <figure className='flex justify-center max-w-xs mb-5'>
        <Link to='/'>
          <img
            className='w-20'
            src='https://user-images.githubusercontent.com/1074042/229266531-5060f1a7-b270-481c-8bac-db74b46214ee.svg'
          />
        </Link>
      </figure>
      <h2
        className='text-center font-title font-black text-primary text-lg transition-all duration-200 md:text-3xl mb-5 uppercase
'
      >
        <Link to='/'>Codependence</Link>
      </h2>
      <h3 className='font-title text-base-content inline-flex text-sm transition-all duration-200 md:text-3m pl-4'>
        Codependence is a JavaScript utility for checking dependencies to ensure they're up-to-date or match a specified
        version.
      </h3>
      <Divider />

      <Collapse
        onToggle={onToggleDeadSimple}
        style={{ visibility: 'visible' }}
        checkbox
        icon='arrow'
        className='visible border border-base-300 bg-base-100 rounded-box p-2'
      >
        <Collapse.Title className='text-md font-bold pb-4 pl-4'>
          Do you want a dead simple way to maintain npm dependencies?
        </Collapse.Title>

        <Collapse.Content>
          <ul className='ul'>
            <li>
              <a href='#main-usecase'>Main Usecase</a>
            </li>
            <li>
              <a href='#synopsis'>Synopsis</a>
            </li>
            <li>
              <a href='#why-use-codependence'>Why use Codependence?</a>
            </li>
            <li>
              <a href='#why-not-use-codependence'>Why not use Codependence?</a>
            </li>
          </ul>
        </Collapse.Content>
      </Collapse>
      <Divider />
      <Menu>
        <Menu.Item className='mb-2'>
          <Link to='/usage/'>Basic Usage</Link>
        </Menu.Item>
        <Menu.Item className='mb-2'>
          <Link to='/cli/'>CLI</Link>
        </Menu.Item>
        <Menu.Item className='mb-2'>
          <Link to='/node/'>Node</Link>
        </Menu.Item>
        <Menu.Item className='mb-2'>
          <Link to='/options/'>Options</Link>
        </Menu.Item>
        <Menu.Item className='mb-2'>
          <Link to='/recipes/'>Recipes</Link>
        </Menu.Item>
      </Menu>
    </aside>
  )
}
