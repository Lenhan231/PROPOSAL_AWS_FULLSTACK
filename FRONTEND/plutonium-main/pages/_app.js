import "../styles/global.css";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "../src/contexts/AuthContext";
import { Amplify } from "aws-amplify";
import awsConfig from "../src/aws-config.js";


function MyApp({ Component, pageProps }) {
  Amplify.configure(awsConfig);
  return (
    <ThemeProvider attribute="class">
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default MyApp;
