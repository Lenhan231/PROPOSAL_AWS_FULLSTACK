import { motion } from 'framer-motion';
import { buttonHover, buttonTap } from '../lib/animations';

export default function AnimatedButton({ 
  children, 
  className = '', 
  variant = 'primary',
  ...props 
}) {
  const baseClasses = 'px-6 py-3 font-semibold rounded-xl transition-all duration-300';
  
  const variants = {
    primary: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-xl hover:shadow-blue-500/50',
    secondary: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-200 dark:border-gray-700 hover:border-blue-600 dark:hover:border-blue-500',
    success: 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-xl hover:shadow-green-500/50',
    danger: 'bg-gradient-to-r from-red-600 to-pink-600 text-white hover:shadow-xl hover:shadow-red-500/50',
    ghost: 'bg-transparent text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800',
  };

  return (
    <motion.button
      whileHover={buttonHover}
      whileTap={buttonTap}
      className={`${baseClasses} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
