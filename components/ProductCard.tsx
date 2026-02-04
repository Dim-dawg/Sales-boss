import React from 'react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  return (
    <div className="bg-slate-800 rounded-lg p-4 shadow-lg border border-slate-700 hover:border-sky-500 transition-colors duration-200 flex flex-col gap-3 animate-fade-in-up">
      <div className="relative h-40 bg-slate-700 rounded-md overflow-hidden">
        <img 
          src={product.imageUrl} 
          alt={product.name} 
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 right-2 bg-yellow-500 text-slate-900 font-bold px-2 py-1 rounded text-xs">
          Amazon Choice
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold text-white leading-tight">{product.name}</h3>
        <p className="text-sky-400 font-bold text-xl mt-1">{product.price}</p>
        <div className="flex items-center gap-1 mt-1">
          {[...Array(5)].map((_, i) => (
            <svg key={i} className={`w-4 h-4 ${i < Math.floor(product.rating) ? 'text-yellow-500' : 'text-slate-600'}`} fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
          <span className="text-xs text-slate-400 ml-1">({Math.floor(Math.random() * 5000)} reviews)</span>
        </div>
        <p className="text-slate-300 text-sm mt-2 line-clamp-2">{product.description}</p>
      </div>
      <button className="mt-auto w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2">
        <span>Buy Now</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
      </button>
    </div>
  );
};

export default ProductCard;
