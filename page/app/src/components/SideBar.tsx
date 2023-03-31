import React from 'react'
import { Divider } from 'react-daisyui'
import { FaRegLightbulb } from 'react-icons/fa'

export const SideBar = () => {
  return (
    <aside className='sidebar menu p-4 overflow-y-auto w-80 bg-base-100 text-base-content bg-base-200'>
      <figure className='flex justify-center max-w-xs mb-5'></figure>
      <h2 className='font-title font-black text-primary inline-flex text-lg transition-all duration-200 md:text-3xl mb-5'>
        Codependence
      </h2>
      <h3 className='font-title text-base-content inline-flex text-sm transition-all duration-200 md:text-3m pl-4'>
        Todo
      </h3>
      <Divider />
      <p className='font-bold'>Todo</p>
      <Divider />
      <ul className='ul'>
        <li>
          <a href='#'>
            <FaRegLightbulb /> Thing
          </a>
        </li>
      </ul>
    </aside>
  )
}
