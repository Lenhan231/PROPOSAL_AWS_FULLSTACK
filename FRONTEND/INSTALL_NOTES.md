# Installation Notes

## ✅ Required Dependencies

All required dependencies have been installed. Run this command to install everything:

```bash
cd FRONTEND/plutonium-main
npm install
```

## 📦 Key Dependencies

### Production Dependencies
- `@tanstack/react-query` (v5.90.10) - Server state management
- `@tanstack/react-query-devtools` (v5.90.2) - React Query debugging tool
- `axios` (v1.13.2) - HTTP client
- `zustand` (v5.0.8) - Client state management
- `next` (v16.0.3) - React framework
- `next-themes` (v0.2.1) - Dark mode support
- `react` (v18.2.0) - React library
- `react-dom` (v18.2.0) - React DOM
- `lucide-react` (v0.554.0) - Icons
- `next-seo` (v6.5.0) - SEO optimization

### Dev Dependencies
- `tailwindcss` (v3.3.5) - CSS framework
- `autoprefixer` (v10.4.16) - CSS post-processor
- `postcss` (v8.4.31) - CSS transformer
- `eslint` (v8.54.0) - Linting
- `eslint-config-next` (v13.5.6) - Next.js ESLint config

## 🔧 Installation Steps

### 1. Clean Install (if needed)
```bash
cd FRONTEND/plutonium-main
rm -rf node_modules package-lock.json
npm install
```

### 2. Verify Installation
```bash
npm run build
```

Should see: `✓ Compiled successfully`

### 3. Run Development Server
```bash
npm run dev
```

Open http://localhost:3000

## ⚠️ Common Issues

### Issue: "Module not found: @tanstack/react-query-devtools"
**Solution**: Already fixed! Package is now in package.json

### Issue: "Module not found: zustand"
**Solution**: Run `npm install zustand`

### Issue: Build warnings about multiple lockfiles
**Solution**: This is expected. We have lockfiles at different levels:
- Root: `package-lock.json`
- Frontend: `FRONTEND/package-lock.json`
- Plutonium: `FRONTEND/plutonium-main/package-lock.json`

This is normal for monorepo structure.

## ✅ Verification

After installation, verify:
- [ ] `node_modules` folder exists
- [ ] `npm run build` succeeds
- [ ] `npm run dev` starts server
- [ ] No module not found errors
- [ ] Can access http://localhost:3000

## 📝 Notes

- All dependencies are pinned to specific versions for stability
- React Query Devtools is included for development debugging
- Zustand is lightweight (< 1KB) for UI state
- Axios is used for HTTP requests with interceptors

## 🚀 Ready to Go!

If all checks pass, you're ready to start development!

Next steps:
1. Read `GETTING_STARTED.md`
2. Read `PHASE2_CHECKLIST.md`
3. Start coding!
