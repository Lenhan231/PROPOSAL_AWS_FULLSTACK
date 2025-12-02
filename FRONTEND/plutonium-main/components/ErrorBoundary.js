import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🛑 ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full border-4 border-red-500">
            <div className="text-center">
              <div className="text-6xl mb-4">🛑</div>
              <h1 className="text-3xl font-bold text-red-600 mb-4">
                Lỗi Nghiêm Trọng
              </h1>
              <p className="text-gray-700 mb-6">
                Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.
              </p>
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-800 font-mono break-all">
                  {this.state.error?.message || 'Unknown error'}
                </p>
              </div>
              <button
                onClick={() => window.location.href = '/'}
                className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
              >
                Quay về Trang Chủ
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
