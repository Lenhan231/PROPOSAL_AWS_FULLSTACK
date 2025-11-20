// AWS Amplify Configuration for Cognito
export const amplifyConfig = {
  Auth: {
    region: process.env.NEXT_PUBLIC_REGION,
    userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID,
    userPoolWebClientId: process.env.NEXT_PUBLIC_CLIENT_ID,
    
    // Optional: Customize authentication flow
    authenticationFlowType: 'USER_SRP_AUTH',
    
    // Optional: Cookie storage for SSR
    cookieStorage: {
      domain: typeof window !== 'undefined' ? window.location.hostname : '',
      path: '/',
      expires: 365,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    },
  },
};

// Validation helper
export const validateAmplifyConfig = () => {
  const required = [
    'NEXT_PUBLIC_REGION',
    'NEXT_PUBLIC_USER_POOL_ID',
    'NEXT_PUBLIC_CLIENT_ID',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing Amplify environment variables:', missing);
    return false;
  }

  console.log('✅ Amplify configuration validated');
  return true;
};
