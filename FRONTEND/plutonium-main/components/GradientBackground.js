export default function GradientBackground({ variant = 'default' }) {
  const variants = {
    default: 'from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20',
    hero: 'from-blue-600 via-purple-600 to-pink-600',
    success: 'from-green-400 via-emerald-500 to-teal-600',
    warm: 'from-orange-400 via-red-500 to-pink-600',
    cool: 'from-cyan-400 via-blue-500 to-indigo-600',
    sunset: 'from-yellow-400 via-orange-500 to-red-600',
    ocean: 'from-blue-400 via-cyan-500 to-teal-600',
    forest: 'from-green-400 via-emerald-500 to-lime-600',
    royal: 'from-purple-400 via-violet-500 to-indigo-600',
  };

  return (
    <>
      {/* Animated gradient background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div
          className={`absolute inset-0 bg-gradient-to-br ${variants[variant]} opacity-30 dark:opacity-20 animate-gradient`}
          style={{
            backgroundSize: '400% 400%',
          }}
        />

        {/* Mesh gradient overlay */}
        <div className="absolute inset-0 opacity-30">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="rgba(59, 130, 246, 0.1)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Radial gradients */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-400/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '2s' }} />
      </div>
    </>
  );
}
