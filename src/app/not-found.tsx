"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
// import Navbar from '../components/ui/navbar';
// import SesaBG from '../components/ui/sesa_background';
// import SesaIcon from '../components/ui/icons/sesalogoComb';
// import Footer from '@/components/ui/Footer';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* <div className="absolute inset-0 z-0">
        <SesaBG />
      </div> */}

      {/*--------------------------------------------- Main body ---------------------------------------------*/}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* <Navbar /> */}

        <main className="flex-grow flex items-center justify-center px-6 py-12">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-6xl font-bold text-gray-800 mb-8">404</h1>
            <h2 className="text-3xl font-semibold text-gray-700 mb-4">
              Page Not Found
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              The service or page you're looking for is currently under development or doesn't exist.
            </p>
            <div className="space-x-4">
              <button 
                onClick={() => router.back()}
                className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                <svg 
                  className="w-5 h-5 mr-2" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M10 19l-7-7m0 0l7-7m-7 7h18" 
                  />
                </svg>
                Go Back
              </button>
              <Link 
                href="/"
                className="inline-flex items-center px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                <svg 
                  className="w-5 h-5 mr-2" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
                  />
                </svg>
                Home
              </Link>
            </div>
          </div>
        </main>

        {/* <Footer /> */}
      </div>
    </div>
  );
}
