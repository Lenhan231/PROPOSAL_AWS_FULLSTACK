const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
      region: process.env.NEXT_PUBLIC_REGION || 'ap-southeast-1',
      // Only include OAuth if domain is configured
      ...(process.env.NEXT_PUBLIC_COGNITO_DOMAIN && {
        loginWith: {
          oauth: {
            domain: (process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '').replace('https://', ''),
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [process.env.NEXT_PUBLIC_REDIRECT_URL || 'http://localhost:3000'],
            redirectSignOut: [process.env.NEXT_PUBLIC_REDIRECT_URL || 'http://localhost:3000'],
            responseType: 'code',
          },
        },
      }),
    },
  },
};

// Debug logging
if (typeof window !== 'undefined') {
  const configValues = {
    region: awsConfig.Auth.Cognito.region,
    userPoolId: awsConfig.Auth.Cognito.userPoolId,
    clientId: awsConfig.Auth.Cognito.userPoolClientId,
    domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || 'Not configured (optional)',
    redirectUrl: process.env.NEXT_PUBLIC_REDIRECT_URL || 'http://localhost:3000',
  };
  
  console.log('✅ AWS Amplify Config:', configValues);
  
  // Validate required fields using actual config values
  const missingFields = [];
  if (!awsConfig.Auth.Cognito.region) missingFields.push('region');
  if (!awsConfig.Auth.Cognito.userPoolId) missingFields.push('userPoolId');
  if (!awsConfig.Auth.Cognito.userPoolClientId) missingFields.push('userPoolClientId');
  
  if (missingFields.length > 0) {
    console.error('❌ Missing required Amplify config:', missingFields);
  } else {
    console.log('✅ All required Amplify config present');
  }
}

export default awsConfig;