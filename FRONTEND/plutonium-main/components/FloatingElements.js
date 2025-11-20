import { motion } from 'framer-motion';

export default function FloatingElements() {
  const elements = [
    { icon: '📚', delay: 0, duration: 20, x: '10%', y: '20%' },
    { icon: '✨', delay: 2, duration: 25, x: '80%', y: '10%' },
    { icon: '🎨', delay: 4, duration: 22, x: '15%', y: '70%' },
    { icon: '🚀', delay: 1, duration: 23, x: '85%', y: '60%' },
    { icon: '💡', delay: 3, duration: 21, x: '50%', y: '40%' },
    { icon: '🎯', delay: 5, duration: 24, x: '70%', y: '80%' },
  ];

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {elements.map((element, index) => (
        <motion.div
          key={index}
          className="absolute text-4xl opacity-20 dark:opacity-10"
          style={{
            left: element.x,
            top: element.y,
          }}
          animate={{
            y: [0, -30, 0],
            rotate: [0, 10, -10, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: element.duration,
            repeat: Infinity,
            delay: element.delay,
            ease: 'easeInOut',
          }}
        >
          {element.icon}
        </motion.div>
      ))}
    </div>
  );
}
