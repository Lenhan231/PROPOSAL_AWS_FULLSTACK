import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const checkPasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    setPasswordStrength(strength);
  };

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setFormData({ ...formData, password: newPassword });
    checkPasswordStrength(newPassword);
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 2) return "bg-red-500";
    if (passwordStrength === 3) return "bg-yellow-500";
    if (passwordStrength === 4) return "bg-blue-500";
    return "bg-green-500";
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength === 0) return "";
    if (passwordStrength <= 2) return "Yếu";
    if (passwordStrength === 3) return "Trung bình";
    if (passwordStrength === 4) return "Mạnh";
    return "Rất mạnh";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.name.trim()) {
      setError("Vui lòng nhập họ tên!");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp!");
      return;
    }

    if (formData.password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự!");
      return;
    }

    if (passwordStrength < 3) {
      setError("Mật khẩu quá yếu! Vui lòng sử dụng mật khẩu mạnh hơn.");
      return;
    }

    if (!formData.agreeToTerms) {
      setError("Vui lòng đồng ý với điều khoản sử dụng!");
      return;
    }

    setLoading(true);

    try {
      // TODO: Implement Cognito signup
      // await Auth.signUp({
      //   username: formData.email,
      //   password: formData.password,
      //   attributes: { name: formData.name }
      // });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Show success message and redirect
      alert("Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.");
      router.push("/login");
    } catch (err) {
      setError(err.message || "Đăng ký thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20">
      <Head>
        <title>Đăng ký - Thư Viện Online</title>
      </Head>

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl -z-10"></div>

      <div className="relative flex items-center justify-center min-h-screen px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo/Brand */}
          <div className="mb-8 text-center">
            <Link href="/" className="inline-flex items-center justify-center space-x-2 text-3xl font-bold text-gray-900 transition-colors dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
              <span>📚</span>
              <span>Thư Viện Online</span>
            </Link>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Tạo tài khoản mới
            </p>
          </div>

          {/* Signup Card */}
          <div className="p-8 bg-white border border-gray-200 shadow-2xl rounded-2xl dark:bg-gray-800 dark:border-gray-700">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
                  <div className="flex items-center">
                    <span className="mr-2 text-red-600 dark:text-red-400">⚠️</span>
                    <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                  </div>
                </div>
              )}

              {/* Name Field */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                  Họ và tên
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 text-gray-900 transition-colors bg-white border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nguyễn Văn A"
                  required
                />
              </div>

              {/* Email Field */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 text-gray-900 transition-colors bg-white border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your@email.com"
                  required
                />
              </div>

              {/* Password Field */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                  Mật khẩu
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-3 pr-12 text-gray-900 transition-colors bg-white border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-600 transition-colors dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {formData.password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            level <= passwordStrength
                              ? getPasswordStrengthColor()
                              : "bg-gray-200 dark:bg-gray-700"
                          }`}
                        ></div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Độ mạnh: <span className="font-medium">{getPasswordStrengthText()}</span>
                    </p>
                  </div>
                )}

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt
                </p>
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                  Xác nhận mật khẩu
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 pr-12 text-gray-900 transition-colors bg-white border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-600 transition-colors dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    {showConfirmPassword ? "🙈" : "👁️"}
                  </button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    Mật khẩu không khớp
                  </p>
                )}
              </div>

              {/* Terms & Conditions */}
              <div>
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.agreeToTerms}
                    onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                    className="w-4 h-4 mt-1 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    required
                  />
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    Tôi đồng ý với{" "}
                    <Link href="/terms" className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                      Điều khoản sử dụng
                    </Link>{" "}
                    và{" "}
                    <Link href="/privacy" className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                      Chính sách bảo mật
                    </Link>
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 font-semibold text-white transition-all duration-300 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:shadow-xl hover:shadow-blue-500/50 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Đang đăng ký...
                  </span>
                ) : (
                  "Đăng ký"
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 text-gray-500 bg-white dark:bg-gray-800 dark:text-gray-400">
                  Hoặc
                </span>
              </div>
            </div>

            {/* Login Link */}
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Đã có tài khoản?{" "}
                <Link href="/login" className="font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                  Đăng nhập ngay
                </Link>
              </p>
            </div>
          </div>

          {/* Back to Home */}
          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
              ← Quay về trang chủ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
