# Frontend - Thư Viện Online

## 📚 Overview

Frontend cho hệ thống **Thư Viện Online** - nền tảng serverless để chia sẻ tài liệu PDF/ePub.

**Tech Stack**: Next.js 13, React 18, TanStack Query, Zustand, Tailwind CSS

---

## 🚀 Quick Start

```bash
cd plutonium-main
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Test Accounts** (Mock):
- User: `user@example.com` / `Password123!`
- Admin: `admin@example.com` / `Admin123!`

---

## 📁 Documentation

- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Setup & installation guide
- **[PROGRESS.md](./PROGRESS.md)** - Implementation progress tracker
- **[COMPLETED_PHASE1.md](./COMPLETED_PHASE1.md)** - Phase 1 summary
- **[PHASE2_CHECKLIST.md](./PHASE2_CHECKLIST.md)** - Phase 2 tasks
- **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - Full technical guide

---

## 📊 Current Status

### ✅ Phase 1: Infrastructure (100% Complete)

**Completed:**
- ✅ Configuration & environment setup
- ✅ API client with Axios interceptors
- ✅ Authentication system (Mock + Real Amplify ready)
- ✅ State management (TanStack Query + Zustand + Context)
- ✅ Custom hooks (useBooks, useUpload)
- ✅ Protected routes
- ✅ Toast notifications
- ✅ Error handling
- ✅ Updated login/signup pages
- ✅ Updated header with auth state

**What Works:**
- Login/Logout
- User/Admin role detection
- Protected routes
- Toast notifications
- Dark mode
- Responsive design

### ⏳ Phase 2: Page Logic (0% Complete)

**TODO:**
- [ ] Update upload.js with useUpload hook
- [ ] Update books.js with useSearchBooks hook
- [ ] Update my-uploads.js with useMyUploads hook
- [ ] Rewrite admin/pending.js with admin hooks
- [ ] Create books/[bookId].js for book reader
- [ ] Install react-pdf and epub.js
- [ ] Add loading skeletons
- [ ] Add modal component

---

## 🏗️ Architecture

### State Management Strategy

```
┌─────────────────────────────────────────┐
│         React Application               │
├─────────────────────────────────────────┤
│  ┌────────────────┐  ┌──────────────┐  │
│  │ TanStack Query │  │   Zustand    │  │
│  │ (Server State) │  │ (UI State)   │  │
│  └────────────────┘  └──────────────┘  │
│         │                    │          │
│  • Books data        • Modals          │
│  • Uploads           • Toasts          │
│  • Admin data        • Sidebar         │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │    React Context (Auth Only)     │  │
│  │  • User  • isAdmin  • signOut    │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Folder Structure

```
plutonium-main/
├── components/       # React components
├── hooks/           # Custom hooks
├── lib/             # Utilities & config
├── pages/           # Next.js pages
├── store/           # State management
├── styles/          # Global styles
└── public/          # Static assets
```

---

## 🔧 Key Features

### 1. Authentication
- Mock auth for development
- Real AWS Cognito ready (commented)
- JWT token management
- Auto-refresh token
- Role-based access (User/Admin)

### 2. API Integration
- Axios client with interceptors
- Automatic token injection
- Error handling
- Request/response logging

### 3. State Management
- **Server State**: TanStack Query
- **Client State**: Zustand
- **Auth State**: React Context

### 4. Custom Hooks
```javascript
// Books
useSearchBooks(params)
useReadUrl(bookId)
useMyUploads(params)

// Admin
usePendingBooks(params)
useApproveBook()
useRejectBook()

// Upload
useUpload()
```

### 5. Components
```javascript
<ProtectedRoute requireAdmin={false}>
<ToastContainer />
<Toast type="success|error|warning|info" />
```

---

## 🧪 Testing

### Manual Testing

1. **Login Flow**
   ```
   1. Go to /login
   2. Use test account
   3. Check user info in header
   4. Try logout
   ```

2. **Protected Routes**
   ```
   1. Try /upload without login → redirects
   2. Login and access /upload → works
   3. Try /admin as user → redirects
   4. Login as admin → works
   ```

3. **Toast Notifications**
   ```
   1. Login with wrong password → error toast
   2. Successful actions → success toast
   ```

### React Query Devtools

- Look for flower icon at bottom
- Click to see queries, cache, mutations
- Useful for debugging API calls

---

## 🐛 Troubleshooting

### Common Issues

**"Module not found"**
```bash
rm -rf node_modules package-lock.json
npm install
```

**"useAuth must be used within AuthProvider"**
- Check `_app.js` has `<AuthProvider>`

**API calls fail**
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Check backend is running
- Check CORS config

---

## 📝 Development Workflow

### 1. Setup
```bash
cd plutonium-main
npm install
cp .env.example .env.local
# Edit .env.local
npm run dev
```

### 2. Development
- Start with Phase 2 tasks
- Test each feature incrementally
- Use React Query Devtools
- Check console logs

### 3. Testing
- Manual testing with test accounts
- Check all user flows
- Test error cases
- Test loading states

---

## 🎯 Next Steps

### For Developers

1. Read `GETTING_STARTED.md`
2. Read `PHASE2_CHECKLIST.md`
3. Start with Task 1 (Upload Page)
4. Test thoroughly
5. Move to next task

### For Backend Team

When backend is ready:
1. Update `.env.local` with real API URL
2. Update Cognito credentials
3. Uncomment real Amplify code in `lib/auth.js`
4. Test integration

---

## 📚 Resources

- [Next.js Docs](https://nextjs.org/docs)
- [TanStack Query](https://tanstack.com/query/latest)
- [Zustand](https://github.com/pmndrs/zustand)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [AWS Amplify](https://docs.amplify.aws/)

---

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Commit with clear message
5. Push and create PR

---

## 📞 Support

Need help?
1. Check documentation files
2. Check console logs
3. Check React Query Devtools
4. Ask team members

---

**Status**: Phase 1 Complete ✅ | Phase 2 In Progress ⏳

**Last Updated**: 2025-01-20
