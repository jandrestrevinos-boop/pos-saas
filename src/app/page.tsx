'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  Package,
  Utensils,
  Users,
  BarChart3,
  MessageCircle,
  Smartphone,
  Settings,
  TrendingUp,
  UtensilsCrossed,
  Coffee,
  Flame,
  Zap,
  Martini,
  Store,
} from 'lucide-react';

const WHATSAPP_LINK = 'https://api.whatsapp.com/send/?phone=5218123557288&text=Quiero%20agendar%20una%20demo';

export default function TappyLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="min-h-screen bg-white text-gray-900 scroll-smooth">
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeIn 0.5s ease-out; }
        .hover-scale { transition: all 300ms ease; }
        .hover-scale:hover { transform: scale(1.05); }
      `}</style>


    
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
                
                <a href="/" className="flex-shrink-0 font-bold text-2xl flex items-center gap-2 hover:opacity-80 transition">
                    <img src="/images/logo.png" alt="Tappy" className="h-16 w-auto" />
                </a>

                
                <div className="hidden md:flex items-center gap-8">
                    <a href="#inicio" className="text-gray-700 hover:text-blue-600 transition font-medium">Inicio</a>
                    <a href="#tipos" className="text-gray-700 hover:text-blue-600 transition font-medium">Tipos de Restaurante</a>
                    <a href="#planes" className="text-gray-700 hover:text-blue-600 transition font-medium">Planes</a>
                </div>

                
                <div className="hidden md:flex items-center gap-4">
                    <a href="/login" className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all duration-300 hover-scale">
                        Acceder a Tappy
                    </a>
                </div>

                
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-gray-700 hover:text-blue-600 focus:outline-none">
                    {mobileMenuOpen ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                      </svg>
                    )}
                </button>
            </div>

            {mobileMenuOpen && (
            <div className="md:hidden pb-4 pt-2 border-t border-gray-100">
                <a onClick={() => setMobileMenuOpen(false)} href="#inicio" className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded font-medium transition">Inicio</a>
                <a onClick={() => setMobileMenuOpen(false)} href="#tipos" className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded font-medium transition">Tipos de Restaurante</a>
                <a onClick={() => setMobileMenuOpen(false)} href="#planes" className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded font-medium transition">Planes</a>
                <div className="px-4 py-2 mt-2">
                    <a onClick={() => setMobileMenuOpen(false)} href="/login" className="block w-full text-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg font-semibold transition">
                        Acceder a Tappy
                    </a>
                </div>
            </div>
            )}
        </div>
    </nav>

    
    <section id="inicio" className="pt-20 pb-16 md:pt-32 md:pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
                
                <div className="space-y-8 fade-in">
                    <div className="space-y-4">
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                            El control de tu restaurante, en un solo lugar.
                        </h1>
                        <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
                            Tappy es el sistema POS que te ayuda a administrar ventas, inventario, productos, usuarios y operación desde una sola plataforma.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <a href="#planes" className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg font-semibold hover:shadow-xl transition-all duration-300 hover-scale text-center">
                            Ver planes
                        </a>
                        <a href="https://api.whatsapp.com/send/?phone=5218123557288&text=Quiero%20agendar%20una%20demo" target="_blank" className="px-8 py-4 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-all duration-300 text-center">
                            Hablar con asesor
                        </a>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                        <a href="/login" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold group transition">
                            ¿Ya eres cliente? Acceder a Tappy
                            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                            </svg>
                        </a>
                    </div>
                </div>

                
                <div className="relative hidden md:block">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-green-400 rounded-3xl blur-3xl opacity-20"></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 border border-gray-100">
                        
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg"></div>
                                <div>
                                    <p className="text-xs text-gray-500">Dashboard</p>
                                    <p className="text-sm font-semibold text-gray-900">Hoy</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                            </div>
                        </div>

                        
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                                <p className="text-xs text-gray-600 mb-1">Ventas</p>
                                <p className="text-2xl font-bold text-blue-900">$24,850</p>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                                <p className="text-xs text-gray-600 mb-1">Órdenes</p>
                                <p className="text-2xl font-bold text-green-900">186</p>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                                <p className="text-xs text-gray-600 mb-1">Ticket Promedio</p>
                                <p className="text-2xl font-bold text-purple-900">$133</p>
                            </div>
                            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4">
                                <p className="text-xs text-gray-600 mb-1">Productos</p>
                                <p className="text-2xl font-bold text-amber-900">438</p>
                            </div>
                        </div>

                        
                        <div className="bg-gray-50 rounded-lg p-4 h-32 flex items-end gap-2">
                            <div className="flex-1 bg-gradient-to-t from-blue-400 to-green-300 rounded-t opacity-80 hover:opacity-100 transition" style="height: 40%;"></div>
                            <div className="flex-1 bg-gradient-to-t from-blue-400 to-green-300 rounded-t opacity-80 hover:opacity-100 transition" style="height: 60%;"></div>
                            <div className="flex-1 bg-gradient-to-t from-blue-400 to-green-300 rounded-t opacity-80 hover:opacity-100 transition" style="height: 45%;"></div>
                            <div className="flex-1 bg-gradient-to-t from-blue-400 to-green-300 rounded-t opacity-80 hover:opacity-100 transition" style="height: 70%;"></div>
                            <div className="flex-1 bg-gradient-to-t from-blue-400 to-green-300 rounded-t opacity-80 hover:opacity-100 transition" style="height: 55%;"></div>
                            <div className="flex-1 bg-gradient-to-t from-blue-400 to-green-300 rounded-t opacity-80 hover:opacity-100 transition" style="height: 80%;"></div>
                            <div className="flex-1 bg-gradient-to-t from-blue-400 to-green-300 rounded-t opacity-80 hover:opacity-100 transition" style="height: 75%;"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    
    <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">¿Qué es Tappy?</h2>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                    Una plataforma POS SaaS diseñada para ayudarte a controlar la operación de tu negocio desde cualquier lugar.
                </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 text-center hover:bg-white/20 transition-all duration-300 border border-white/30 shadow-lg hover:shadow-2xl">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20"><CreditCard className="w-7 h-7 text-white" /></div><h3 className="font-semibold text-gray-900 mb-2">Punto de Venta</h3>
                    <p className="text-sm text-gray-600">Gestión completa de caja y mesas</p>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 text-center hover:bg-white/20 transition-all duration-300 border border-white/30 shadow-lg hover:shadow-2xl">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20"><Package className="w-7 h-7 text-white" /></div><h3 className="font-semibold text-gray-900 mb-2">Inventario</h3>
                    <p className="text-sm text-gray-600">Controla stock y repone automáticamente</p>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 text-center hover:bg-white/20 transition-all duration-300 border border-white/30 shadow-lg hover:shadow-2xl">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20"><Utensils className="w-7 h-7 text-white" /></div><h3 className="font-semibold text-gray-900 mb-2">Productos</h3>
                    <p className="text-sm text-gray-600">Administra categorías y precios</p>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 text-center hover:bg-white/20 transition-all duration-300 border border-white/30 shadow-lg hover:shadow-2xl">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20"><Users className="w-7 h-7 text-white" /></div><h3 className="font-semibold text-gray-900 mb-2">Usuarios</h3>
                    <p className="text-sm text-gray-600">Permisos y control de acceso</p>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 text-center hover:bg-white/20 transition-all duration-300 border border-white/30 shadow-lg hover:shadow-2xl">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20"><BarChart3 className="w-7 h-7 text-white" /></div><h3 className="font-semibold text-gray-900 mb-2">Reportes</h3>
                    <p className="text-sm text-gray-600">Datos en tiempo real</p>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 text-center hover:bg-white/20 transition-all duration-300 border border-white/30 shadow-lg hover:shadow-2xl">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20"><MessageCircle className="w-7 h-7 text-white" /></div><h3 className="font-semibold text-gray-900 mb-2">Clientes</h3>
                    <p className="text-sm text-gray-600">Base de datos de tus clientes</p>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 text-center hover:bg-white/20 transition-all duration-300 border border-white/30 shadow-lg hover:shadow-2xl">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20"><Smartphone className="w-7 h-7 text-white" /></div><h3 className="font-semibold text-gray-900 mb-2">Multi-dispositivo</h3>
                    <p className="text-sm text-gray-600">Accede desde donde sea</p>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 text-center hover:bg-white/20 transition-all duration-300 border border-white/30 shadow-lg hover:shadow-2xl">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20"><Settings className="w-7 h-7 text-white" /></div><h3 className="font-semibold text-gray-900 mb-2">Configuración</h3>
                    <p className="text-sm text-gray-600">Personaliza tu sistema</p>
                </div>
            </div>
        </div>
    </section>

    
    <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Todo lo que necesitas para operar</h2>
                <p className="text-lg text-gray-600">Una plataforma integral diseñada para restaurantes</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <div className="flex gap-4 p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/30 hover:bg-white/20 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/20"><TrendingUp className="w-6 h-6" /></div></div><div><h3 className="text-lg font-semibold text-gray-900 mb-1">Ventas</h3>
                        <p className="text-gray-600">Registra y controla todas tus ventas desde el punto de venta.</p>
                    </div>
                </div>

                <div className="flex gap-4 p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/30 hover:bg-white/20 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/20"><Package className="w-6 h-6" /></div></div><div><h3 className="text-lg font-semibold text-gray-900 mb-1">Inventario</h3>
                        <p className="text-gray-600">Conoce qué tienes, qué vendes y qué necesitas reponer.</p>
                    </div>
                </div>

                <div className="flex gap-4 p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/30 hover:bg-white/20 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/20"><BarChart3 className="w-6 h-6" /></div></div><div><h3 className="text-lg font-semibold text-gray-900 mb-1">Reportes</h3>
                        <p className="text-gray-600">Consulta información de tu negocio y toma decisiones basadas en datos.</p>
                    </div>
                </div>

                <div className="flex gap-4 p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/30 hover:bg-white/20 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/20"><Utensils className="w-6 h-6" /></div></div><div><h3 className="text-lg font-semibold text-gray-900 mb-1">Productos</h3>
                        <p className="text-gray-600">Administra productos, precios, categorías y disponibilidad.</p>
                    </div>
                </div>

                <div className="flex gap-4 p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/30 hover:bg-white/20 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/20"><Users className="w-6 h-6" /></div></div><div><h3 className="text-lg font-semibold text-gray-900 mb-1">Usuarios</h3>
                        <p className="text-gray-600">Controla accesos y permisos de tu equipo.</p>
                    </div>
                </div>

                <div className="flex gap-4 p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/30 hover:bg-white/20 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/20"><MessageCircle className="w-6 h-6" /></div></div><div><h3 className="text-lg font-semibold text-gray-900 mb-1">Clientes</h3>
                        <p className="text-gray-600">Construye una base de clientes y conoce mejor tu operación.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    
    <section id="tipos" className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Tappy se adapta a tu negocio</h2>
                <p className="text-lg text-gray-600">Identifica tu tipo de restaurante y descubre cómo Tappy puede ayudarte</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="group bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/30 hover:bg-white/20 hover:shadow-2xl transition-all duration-300 cursor-pointer">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 rounded-2xl mb-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/20"><UtensilsCrossed className="w-8 h-8 text-white" /></div><h3 className="text-xl font-semibold text-gray-900 mb-2">Restaurante</h3>
                    <p className="text-gray-600 mb-4">Controla ventas, productos, inventario y operación diaria.</p>
                    <a href="#" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold group/btn transition">
                        Conoce más
                        <svg className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                        </svg>
                    </a>
                </div>

                <div className="group bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/30 hover:bg-white/20 hover:shadow-2xl transition-all duration-300 cursor-pointer">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 rounded-2xl mb-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/20"><Coffee className="w-8 h-8 text-white" /></div><h3 className="text-xl font-semibold text-gray-900 mb-2">Cafetería</h3>
                    <p className="text-gray-600 mb-4">Agiliza pedidos y controla tus productos desde un solo lugar.</p>
                    <a href="#" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold group/btn transition">
                        Conoce más
                        <svg className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                        </svg>
                    </a>
                </div>

                <div className="group bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/30 hover:bg-white/20 hover:shadow-2xl transition-all duration-300 cursor-pointer">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 rounded-2xl mb-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/20"><Flame className="w-8 h-8 text-white" /></div><h3 className="text-xl font-semibold text-gray-900 mb-2">Taquería</h3>
                    <p className="text-gray-600 mb-4">Registra ventas rápidamente y controla tus productos.</p>
                    <a href="#" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold group/btn transition">
                        Conoce más
                        <svg className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                        </svg>
                    </a>
                </div>

                <div className="group bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/30 hover:bg-white/20 hover:shadow-2xl transition-all duration-300 cursor-pointer">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 rounded-2xl mb-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/20"><Zap className="w-8 h-8 text-white" /></div><h3 className="text-xl font-semibold text-gray-900 mb-2">Comida Rápida</h3>
                    <p className="text-gray-600 mb-4">Reduce tiempos de atención y mantén el control de tus ventas.</p>
                    <a href="#" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold group/btn transition">
                        Conoce más
                        <svg className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                        </svg>
                    </a>
                </div>

                <div className="group bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/30 hover:bg-white/20 hover:shadow-2xl transition-all duration-300 cursor-pointer">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 rounded-2xl mb-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/20"><Martini className="w-8 h-8 text-white" /></div><h3 className="text-xl font-semibold text-gray-900 mb-2">Bar</h3>
                    <p className="text-gray-600 mb-4">Controla productos, ventas e inventario.</p>
                    <a href="#" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold group/btn transition">
                        Conoce más
                        <svg className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                        </svg>
                    </a>
                </div>

                <div className="group bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/30 hover:bg-white/20 hover:shadow-2xl transition-all duration-300 cursor-pointer">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 rounded-2xl mb-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/20"><Store className="w-8 h-8 text-white" /></div><h3 className="text-xl font-semibold text-gray-900 mb-2">Restaurante Pequeño</h3>
                    <p className="text-gray-600 mb-4">Empieza con las herramientas necesarias para tu negocio.</p>
                    <a href="#" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold group/btn transition">
                        Conoce más
                        <svg className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    </section>

    
    <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">¿Por qué Tappy?</h2>
                <p className="text-lg text-gray-600">Argumentos claros para elegir Tappy</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <div className="relative pl-8 py-4 border-l-4 border-blue-500 hover:border-green-400 transition-all duration-300">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Simple</h3>
                    <p className="text-gray-600">Una plataforma diseñada para que puedas comenzar rápidamente.</p>
                </div>

                <div className="relative pl-8 py-4 border-l-4 border-blue-500 hover:border-green-400 transition-all duration-300">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">En la nube</h3>
                    <p className="text-gray-600">Accede a la información de tu negocio desde donde estés.</p>
                </div>

                <div className="relative pl-8 py-4 border-l-4 border-blue-500 hover:border-green-400 transition-all duration-300">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Escalable</h3>
                    <p className="text-gray-600">Comienza con lo necesario y aumenta capacidades conforme crece tu negocio.</p>
                </div>

                <div className="relative pl-8 py-4 border-l-4 border-blue-500 hover:border-green-400 transition-all duration-300">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Información en tiempo real</h3>
                    <p className="text-gray-600">Consulta el estado de tu operación sin depender de hojas de cálculo.</p>
                </div>

                <div className="relative pl-8 py-4 border-l-4 border-blue-500 hover:border-green-400 transition-all duration-300">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Fácil de usar</h3>
                    <p className="text-gray-600">Una interfaz intuitiva tanto para propietarios como para empleados.</p>
                </div>

                <div className="relative pl-8 py-4 border-l-4 border-blue-500 hover:border-green-400 transition-all duration-300">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Soporte dedicado</h3>
                    <p className="text-gray-600">Un equipo listo para ayudarte en cada paso de tu operación.</p>
                </div>
            </div>
        </div>
    </section>

    
    <section id="planes" className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Elige el plan que se adapte a tu negocio</h2>
                <p className="text-lg text-gray-600">Empieza con lo que necesitas y escala cuando tu negocio crezca.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                
                <div className="bg-white rounded-2xl p-8 border border-gray-200 hover:border-blue-300 transition-all duration-300">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">🟢 Tappy Básico</h3>
                    <div className="mb-6">
                        <span className="text-4xl font-bold text-blue-600">$299</span>
                        <span className="text-gray-600 ml-2">MXN/mes</span>
                    </div>
                    <p className="text-gray-600 mb-8">Negocios que comienzan o tienen una sola operación</p>
                    <ul className="space-y-3 mb-8 text-sm">
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>1 Sucursal</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>4 Usuarios incluidos</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>2 Cajas incluidas</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Inventario avanzado</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Compras y proveedores</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Reportes avanzados</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Dashboard</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Permisos por usuario</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Historial de movimientos</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Alertas</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Promociones y descuentos</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Exportación de información</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Automatizaciones Básicas</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-gray-400">—</span>
                            <span className="text-gray-400">WhatsApp Business</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-gray-400">—</span>
                            <span className="text-gray-400">Pagos integrados</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-gray-400">—</span>
                            <span className="text-gray-400">API</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Soporte Estándar</span>
                        </li>
                    </ul>
                    <button className="w-full px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-all duration-300">
                        Elegir Básico
                    </button>
                </div>

                
                <div className="bg-gradient-to-b from-blue-600 to-blue-700 rounded-2xl p-8 text-white relative md:scale-105 shadow-2xl">
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-400 to-green-400 text-white px-4 py-1 rounded-full text-sm font-semibold">
                        Más popular
                    </div>
                    <h3 className="text-2xl font-bold mb-2">🔵 Tappy Profesional</h3>
                    <div className="mb-6">
                        <span className="text-4xl font-bold">$599</span>
                        <span className="text-blue-200 ml-2">MXN/mes</span>
                    </div>
                    <p className="text-blue-100 mb-8">Negocios que quieren conectar y automatizar</p>
                    <ul className="space-y-3 mb-8 text-sm">
                        <li className="flex items-center gap-3 text-blue-50">
                            <span className="text-green-300 font-bold">✓</span>
                            <span>1 Sucursal</span>
                        </li>
                        <li className="flex items-center gap-3 text-blue-50">
                            <span className="text-green-300 font-bold">✓</span>
                            <span>10 Usuarios incluidos</span>
                        </li>
                        <li className="flex items-center gap-3 text-blue-50">
                            <span className="text-green-300 font-bold">✓</span>
                            <span>3 Cajas incluidas</span>
                        </li>
                        <li className="flex items-center gap-3 text-blue-50">
                            <span className="text-green-300 font-bold">✓</span>
                            <span>Inventario avanzado</span>
                        </li>
                        <li className="flex items-center gap-3 text-blue-50">
                            <span className="text-green-300 font-bold">✓</span>
                            <span>Compras y proveedores</span>
                        </li>
                        <li className="flex items-center gap-3 text-blue-50">
                            <span className="text-green-300 font-bold">✓</span>
                            <span>Reportes avanzados</span>
                        </li>
                        <li className="flex items-center gap-3 text-blue-50">
                            <span className="text-green-300 font-bold">✓</span>
                            <span>Dashboard</span>
                        </li>
                        <li className="flex items-center gap-3 text-blue-50">
                            <span className="text-green-300 font-bold">✓</span>
                            <span>Permisos por usuario</span>
                        </li>
                        <li className="flex items-center gap-3 text-blue-50">
                            <span className="text-green-300 font-bold">✓</span>
                            <span>Historial de movimientos</span>
                        </li>
                        <li className="flex items-center gap-3 text-blue-50">
                            <span className="text-green-300 font-bold">✓</span>
                            <span>Alertas</span>
                        </li>
                        <li className="flex items-center gap-3 text-blue-50">
                            <span className="text-green-300 font-bold">✓</span>
                            <span>Promociones y descuentos</span>
                        </li>
                        <li className="flex items-center gap-3 text-blue-50">
                            <span className="text-green-300 font-bold">✓</span>
                            <span>Exportación de información</span>
                        </li>
                        <li className="flex items-center gap-3 text-blue-50">
                            <span className="text-green-300 font-bold">✓</span>
                            <span>Automatizaciones Avanzadas</span>
                        </li>
                        <li className="flex items-center gap-3 text-blue-50">
                            <span className="text-green-300 font-bold">✓</span>
                            <span>WhatsApp Business</span>
                        </li>
                        <li className="flex items-center gap-3 text-blue-50">
                            <span className="text-green-300 font-bold">✓</span>
                            <span>Pagos integrados</span>
                        </li>
                        <li className="flex items-center gap-3 text-blue-50">
                            <span className="text-green-300 font-bold">✓</span>
                            <span>API</span>
                        </li>
                        <li className="flex items-center gap-3 text-blue-50">
                            <span className="text-green-300 font-bold">✓</span>
                            <span>Soporte Prioritario</span>
                        </li>
                    </ul>
                    <button className="w-full px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-all duration-300">
                        Elegir Profesional
                    </button>
                </div>

                
                <div className="bg-white rounded-2xl p-8 border border-gray-200 hover:border-blue-300 transition-all duration-300">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">🟣 Tappy Empresarial</h3>
                    <div className="mb-6">
                        <span className="text-4xl font-bold text-blue-600">$999</span>
                        <span className="text-gray-600 ml-2">MXN/mes</span>
                    </div>
                    <p className="text-gray-600 mb-8">Empresas que administran varias sucursales</p>
                    <ul className="space-y-3 mb-8 text-sm">
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Hasta 3 Sucursales</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>20 Usuarios incluidos</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>5 Cajas incluidas</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Inventario avanzado</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Compras y proveedores</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Reportes avanzados</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Dashboard Empresarial</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Permisos Avanzados</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Historial de movimientos</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Alertas</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Promociones y descuentos</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Exportación de información</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Automatizaciones Avanzadas</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>WhatsApp Business</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Pagos integrados</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>API Avanzada</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Multi-sucursal</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Inventario entre sucursales</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Reportes consolidados</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Auditoría avanzada</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Soporte Prioritario</span>
                        </li>
                    </ul>
                    <button className="w-full px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-all duration-300">
                        Elegir Empresarial
                    </button>
                </div>
            </div>

            <div className="text-center mt-12 p-8 bg-gray-50 rounded-xl">
                <p className="text-gray-700 mb-4">¿No sabes qué plan necesitas?</p>
                <a href="https://api.whatsapp.com/send/?phone=5218123557288&text=Quiero%20agendar%20una%20demo" target="_blank" className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all duration-300">
                    Hablar con asesor
                </a>
            </div>
        </div>
    </section>

    
    <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Preguntas Frecuentes</h2>
                <p className="text-lg text-gray-600">Resolvemos tus dudas sobre Tappy</p>
            </div>

            <div className="space-y-4">
                
                <div className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-all duration-300">
                    <button onClick={() => setOpenFaq(openFaq === 0 ? null : 0)} className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors">
                        <h3 className="text-lg font-semibold text-gray-900 text-left">¿Qué es Tappy?</h3>
                        <svg className={`w-6 h-6 text-blue-600 flex-shrink-0 transition-transform duration-300 ${openFaq === 0 ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                        </svg>
                    </button>
                    {openFaq === 0 && (
                    <div className="px-6 py-4 bg-white border-t border-gray-200">
                        <p className="text-gray-700 leading-relaxed">Tappy es una plataforma POS SaaS diseñada específicamente para restaurantes y negocios de alimentos. Te permite controlar ventas, inventario, productos, usuarios y toda tu operación desde un solo lugar, en la nube.</p>
                    </div>
                    )}
                </div>

                
                <div className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-all duration-300">
                    <button onClick={() => setOpenFaq(openFaq === 1 ? null : 1)} className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors">
                        <h3 className="text-lg font-semibold text-gray-900 text-left">¿Para qué tipo de restaurantes sirve Tappy?</h3>
                        <svg className={`w-6 h-6 text-blue-600 flex-shrink-0 transition-transform duration-300 ${openFaq === 1 ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                        </svg>
                    </button>
                    {openFaq === 1 && (
                    <div className="px-6 py-4 bg-white border-t border-gray-200">
                        <p className="text-gray-700 leading-relaxed">Tappy se adapta a todo tipo de negocios gastronómicos: restaurantes, cafeterías, taquerías, comida rápida, bares y más. Puedes comenzar en un plan pequeño y escalar cuando tu negocio crezca.</p>
                    </div>
                    )}
                </div>

                
                <div className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-all duration-300">
                    <button onClick={() => setOpenFaq(openFaq === 2 ? null : 2)} className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors">
                        <h3 className="text-lg font-semibold text-gray-900 text-left">¿Tappy funciona en la nube?</h3>
                        <svg className={`w-6 h-6 text-blue-600 flex-shrink-0 transition-transform duration-300 ${openFaq === 2 ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                        </svg>
                    </button>
                    {openFaq === 2 && (
                    <div className="px-6 py-4 bg-white border-t border-gray-200">
                        <p className="text-gray-700 leading-relaxed">Sí, Tappy es 100% en la nube. Esto significa que tu información está segura, respaldada automáticamente y puedes acceder desde cualquier dispositivo con conexión a internet.</p>
                    </div>
                    )}
                </div>

                
                <div className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-all duration-300">
                    <button onClick={() => setOpenFaq(openFaq === 3 ? null : 3)} className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors">
                        <h3 className="text-lg font-semibold text-gray-900 text-left">¿Qué incluye cada plan?</h3>
                        <svg className={`w-6 h-6 text-blue-600 flex-shrink-0 transition-transform duration-300 ${openFaq === 3 ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                        </svg>
                    </button>
                    {openFaq === 3 && (
                    <div className="px-6 py-4 bg-white border-t border-gray-200">
                        <p className="text-gray-700 leading-relaxed">Cada plan incluye Punto de Venta base. Los planes Professional y Enterprise incluyen funciones adicionales como inventario avanzado, reportes más detallados, automatizaciones e integraciones. Consulta la sección de Planes para más detalles.</p>
                    </div>
                    )}
                </div>

                
                <div className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-all duration-300">
                    <button onClick={() => setOpenFaq(openFaq === 4 ? null : 4)} className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors">
                        <h3 className="text-lg font-semibold text-gray-900 text-left">¿Puedo cambiar de plan después?</h3>
                        <svg className={`w-6 h-6 text-blue-600 flex-shrink-0 transition-transform duration-300 ${openFaq === 4 ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                        </svg>
                    </button>
                    {openFaq === 4 && (
                    <div className="px-6 py-4 bg-white border-t border-gray-200">
                        <p className="text-gray-700 leading-relaxed">Sí, puedes cambiar de plan en cualquier momento. Si necesitas más funcionalidades o deseas reducir tu plan, nuestro equipo de asesoramiento te puede ayudar sin problema.</p>
                    </div>
                    )}
                </div>

                
                <div className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-all duration-300">
                    <button onClick={() => setOpenFaq(openFaq === 5 ? null : 5)} className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors">
                        <h3 className="text-lg font-semibold text-gray-900 text-left">¿Cómo es el proceso de implementación?</h3>
                        <svg className={`w-6 h-6 text-blue-600 flex-shrink-0 transition-transform duration-300 ${openFaq === 5 ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                        </svg>
                    </button>
                    {openFaq === 5 && (
                    <div className="px-6 py-4 bg-white border-t border-gray-200">
                        <p className="text-gray-700 leading-relaxed">Primero hablas con nuestro asesor, quien entiende tu negocio. Luego te ofrecemos una propuesta ajustada a tus necesidades, que puede incluir descuentos en hardware. La implementación es simple y rápida.</p>
                    </div>
                    )}
                </div>

                
                <div className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-all duration-300">
                    <button onClick={() => setOpenFaq(openFaq === 6 ? null : 6)} className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors">
                        <h3 className="text-lg font-semibold text-gray-900 text-left">¿Ofrecen soporte técnico?</h3>
                        <svg className={`w-6 h-6 text-blue-600 flex-shrink-0 transition-transform duration-300 ${openFaq === 6 ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                        </svg>
                    </button>
                    {openFaq === 6 && (
                    <div className="px-6 py-4 bg-white border-t border-gray-200">
                        <p className="text-gray-700 leading-relaxed">Sí, ofrecemos soporte dedicado para ayudarte con cualquier duda. Nuestro equipo está disponible para asistirte en la implementación, capacitación y resolución de problemas.</p>
                    </div>
                    )}
                </div>

                
                <div className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-all duration-300">
                    <button onClick={() => setOpenFaq(openFaq === 7 ? null : 7)} className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors">
                        <h3 className="text-lg font-semibold text-gray-900 text-left">¿Qué información necesito para empezar?</h3>
                        <svg className={`w-6 h-6 text-blue-600 flex-shrink-0 transition-transform duration-300 ${openFaq === 7 ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                        </svg>
                    </button>
                    {openFaq === 7 && (
                    <div className="px-6 py-4 bg-white border-t border-gray-200">
                        <p className="text-gray-700 leading-relaxed">Principalmente necesitamos entender: tu tipo de negocio, cantidad de cajas/dispositivos, número de usuarios, productos principales y volumen de operación. Con esto podemos recomendarte el plan ideal.</p>
                    </div>
                    )}
                </div>
            </div>
        </div>
    </section>

    
    <section className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-900 to-blue-900">
        <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
                
                <div className="text-white">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                        No dejes que la operación sea un impedimento, comienza a operar tu restaurante con Tappy
                    </h2>
                    <p className="text-lg text-gray-300 mb-8 leading-relaxed">
                        Simplifica tu operación diaria y enfócate en lo que realmente importa: el servicio y la calidad de tu comida.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                        <a href="https://api.whatsapp.com/send/?phone=5218123557288&text=Quiero%20agendar%20una%20demo" target="_blank" className="px-8 py-4 bg-white text-blue-900 rounded-lg font-semibold hover:bg-gray-100 transition-all duration-300 text-center">
                            Agendar Demo
                        </a>
                        <a href="#planes" className="px-8 py-4 border-2 border-white text-white rounded-lg font-semibold hover:bg-white hover:text-blue-900 transition-all duration-300 text-center">
                            Ver Planes
                        </a>
                    </div>
                </div>

                
                <div className="hidden md:flex items-center justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-3xl blur-3xl opacity-20"></div>
                        <div className="relative bg-white bg-opacity-10 backdrop-blur-md rounded-3xl p-8 border border-white border-opacity-20">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                                    <p className="text-white">Sistema en la nube</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                                    <p className="text-white">Fácil de usar</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                                    <p className="text-white">Soporte dedicado</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                                    <p className="text-white">Implementación rápida</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                                    <p className="text-white">Acceso desde cualquier dispositivo</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    
    <footer className="bg-gray-900 text-gray-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <img src="/images/logo.png" alt="Tappy" className="h-12 w-auto bg-white rounded p-1" />
                    </div>
                    <p className="text-sm">El sistema POS para restaurantes que te ayuda a crecer.</p>
                </div>
                <div>
                    <h4 className="text-white font-semibold mb-4">Producto</h4>
                    <ul className="space-y-2 text-sm">
                        <li><a href="#inicio" className="hover:text-white transition">Inicio</a></li>
                        <li><a href="#tipos" className="hover:text-white transition">Tipos de Restaurante</a></li>
                        <li><a href="#planes" className="hover:text-white transition">Planes</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="text-white font-semibold mb-4">Compañía</h4>
                    <ul className="space-y-2 text-sm">
                        <li><a href="#" className="hover:text-white transition">Sobre nosotros</a></li>
                        <li><a href="#" className="hover:text-white transition">Blog</a></li>
                        <li><a href="#" className="hover:text-white transition">Contacto</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="text-white font-semibold mb-4">Legal</h4>
                    <ul className="space-y-2 text-sm">
                        <li><a href="#" className="hover:text-white transition">Privacidad</a></li>
                        <li><a href="#" className="hover:text-white transition">Términos</a></li>
                    </ul>
                </div>
            </div>

            <div className="border-t border-gray-800 pt-8">
                <div className="text-center">
                    <p className="text-sm">© 2024 Tappy. Todos los derechos reservados.</p>
                </div>
            </div>
        </div>
    </footer>

    
    </div>
  );
}
