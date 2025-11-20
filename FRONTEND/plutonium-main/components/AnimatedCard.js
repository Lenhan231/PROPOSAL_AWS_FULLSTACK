import { motion } from 'framer-motion';
import { cardHover, cardTap } from '../lib/animations';

export default function AnimatedCard({ children, className = '', delay = 0, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={cardHover}
      whileTap={cardTap}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
