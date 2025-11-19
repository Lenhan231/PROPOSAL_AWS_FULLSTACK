// pages/admin/pending.js
import React from 'react';
import Header from '../../components/Header'; // Adjusted path for admin subdirectory
import Footer from '../../components/Footer'; // Adjusted path for admin subdirectory

export default function AdminDashboard() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="border p-6 rounded-lg shadow-md bg-gray-900">
            <h2 className="text-xl font-semibold text-white">Manage Books</h2>
            <p className="text-gray-600 mt-2">Add, edit, or remove books from the store.</p>
            <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">
              View Books
            </button>
          </div>

          {/* Card 2 */}
          <div className="border p-6 rounded-lg shadow-md bg-gray-900">
            <h2 className="text-xl font-semibold text-white">User Uploads</h2>
            <p className="text-gray-600 mt-2">Review files uploaded by users.</p>
            <button className="mt-4 bg-green-600 text-white px-4 py-2 rounded">
              Review Uploads
            </button>
          </div>

          {/* Card 3: Monitor Books */}
          <div className="border p-6 rounded-lg shadow-md bg-gray-900">
            <h2 className="text-xl font-semibold text-white">Monitor Books</h2>
            <p className="text-gray-600 mt-2">Qualify or disqualify books based on criteria.</p>
            <div className="flex flex-col gap-2 mt-4">
              <button className="bg-green-600 text-white px-4 py-2 rounded">
                Qualify Book
              </button>
              <button className="bg-red-600 text-white px-4 py-2 rounded">
                Disqualify Book
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}