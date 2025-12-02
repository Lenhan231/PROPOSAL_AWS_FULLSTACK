import "../styles/global.css";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "../src/contexts/AuthContext";
import { Amplify } from "aws-amplify";
import awsConfig from "../src/aws-config.js";
import { fetchAuthSession } from "aws-amplify/auth";
import { setTokenGetter } from "../lib/api";
import ErrorBoundary from "../components/ErrorBoundary";

// Set up token getter for API client
if (typeof window !== "undefined") {
  // Some third-party scripts assume the Chrome extension API exists; stub to avoid ReferenceError in non-Chrome browsers
  if (typeof window.chrome === "undefined") {
    window.chrome = {};
  }
  setTokenGetter(async () => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString();
    } catch {
      return null;
    }
  });
}

function MyApp({ Component, pageProps }) {
  Amplify.configure(awsConfig);
  
  return (
    <ThemeProvider attribute="class">
      <AuthProvider>
        <ErrorBoundary>
          <Component {...pageProps} />
        </ErrorBoundary>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default MyApp;
