import React from 'react'
import Hero from '../sections/Hero'
import Features from '../sections/Features'
import Productivity from '../sections/Productivity'
import AuthBento from '../sections/AuthBento'

import Navbar from '../components/Navbar'

export default function Landing() {
  return (
    <main className="bg-[#09090B] min-h-screen">
      <Navbar />
      <div className="px-4 pt-6">
        <Hero />
      </div>
      <Features />
      <Productivity />
      <AuthBento />
    </main>
  )
}
