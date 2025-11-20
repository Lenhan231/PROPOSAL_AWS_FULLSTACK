# Getting Started - Frontend Development

## 📋 Prerequisites

- Node.js 16+ 
- npm hoặc yarn
- Git

## 🚀 Installation

### 1. Navigate to Frontend Directory

```bash
cd FRONTEND/plutonium-main
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` và cập nhật các giá trị:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001

# AWS Cognito (TODO: Update when backend is ready)
NEXT_PUBLIC_USER_POOL_ID=ap-southeast-1_XXXXXXXXX
NEXT_PUBLIC_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_REGION=ap-southeast-1
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing with Mock Data

Frontend hiện tại sử dụng **mock authentication** để có thể phát triển độc lập không cần backend.

### Test Accounts

**Regular User:**
- Email: `user@example.com`
- Password: `Password123!`

**Admin User:**
- Email: `admin@example.com`
- Password: `Admin123!`

### Available Features (Mock)

✅ **Working:**
- Login/Logout
- User/Admin role detection
- Protected routes
- Toast notifications
- Dark mode

⏳ **Partially Working (UI only):**
- Upload page (UI ready, needs API connection)
- Books page (UI ready, needs API connection)
- My Uploads page (UI ready, needs API connection)
- Admin page (UI ready, needs full rewrite)

❌ **Not Working:**
- Book reader (not created yet)
- Real file upload
- Real search
- Real admin approval

---

## 📁 Project Structure

```
plutonium-main/
├── components/          # React components
│   ├── Header.js       # Navigation (✅ Updated)
│   ├── Footer.js       # Footer
│   ├── ProtectedRoute.js  # Route protection (✅ New)
│   └── Toast.js        # Notifications (✅ New)
│
├── hooks/              # Custom hooks (✅ New)
│   ├── useBooks.js     # Books data hooks
│   └── useUpload.js    # Upload flow hook
│
├── lib/                # Utilities (✅ New)
│   ├── amplify-config.js  # AWS config
│   ├── api.js          # API client
│   ├── auth.js         # Auth utilities
│   ├── constants.js    # Constants
│   └── errorHandler.js # Error handling
│
├── pages/              # Next.js pages
│   ├── _app.js         # App wrapper (✅ Updated)
│   ├── index.js        # Home page
│   ├── login.js        # Login (✅ Updated)
│   ├── signup.js       # Signup (✅ Updated)
│   ├── books.js        # Browse books (⏳ Needs update)
│   ├── upload.js       # Upload (⏳ Needs update)
│   ├── my-uploads.js   # My uploads (⏳ Needs update)
│   └── admin/
│       └── pending.js  # Admin dashboard (⏳ Needs rewrite)
│
├── store/              # State management (✅ New)
│   ├── authStore.js    # Auth context
│   └── uiStore.js      # UI state (Zustand)
│
├── styles/
│   └── global.css      # Global styles
│
├── .env.local          # Environment variables (✅ New)
├── .env.example        # Env template (✅ New)
└── package.json        # Dependencies
```

---

## 🔧 Development Workflow

### 1. Start Development Server

```bash
npm run dev
```

### 2. Test Authentication

1. Go to [http://localhost:3000/login](http://localhost:3000/login)
2. Login with test account
3. Check if user info appears in header
4. Try accessing protected pages

### 3. Check React Query Devtools

React Query Devtools sẽ xuất hiện ở góc dưới màn hình (biểu tượng hoa).

Click để xem:
- Active queries
- Query cache
- Query status

### 4. Check Toast Notifications

Toast sẽ xuất hiện ở góc trên bên phải khi:
- Login success/fail
- Upload success/fail
- API errors

### 5. Test Dark Mode

Click icon 🌙/☀️ ở header để toggle dark mode.

---

## 🐛 Troubleshooting

### Issue: "Module not found"

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Cannot find module '@tanstack/react-query'"

```bash
# Install missing dependencies
npm install @tanstack/react-query @tanstack/react-query-devtools
```

### Issue: "useAuth must be used within AuthProvider"

Đảm bảo component được wrap trong `<AuthProvider>` trong `_app.js`.

### Issue: API calls fail

Kiểm tra:
1. `NEXT_PUBLIC_API_URL` trong `.env.local`
2. Backend server đang chạy
3. CORS được config đúng trên backend

---

## 📝 Next Steps

### For Frontend Developers

1. **Update upload.js**
   - Import `useUpload` hook
   - Replace mock upload logic
   - Add ProtectedRoute wrapper

2. **Update books.js**
   - Import `useSearchBooks` hook
   - Replace mock data
   - Add pagination

3. **Update my-uploads.js**
   - Import `useMyUploads` hook
   - Replace mock data
   - Add ProtectedRoute wrapper

4. **Rewrite admin/pending.js**
   - Import admin hooks
   - Add ProtectedRoute with `requireAdmin`
   - Implement approve/reject logic

5. **Create books/[bookId].js**
   - Dynamic route for book reader
   - Install react-pdf and epub.js
   - Implement PDF/ePub viewer

### For Backend Developers

When backend is ready:

1. Update `.env.local` with real API URL
2. Update Cognito credentials
3. Uncomment real Amplify code in `lib/auth.js`
4. Comment out mock code
5. Test integration

---

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [TanStack Query](https://tanstack.com/query/latest)
- [Zustand](https://github.com/pmndrs/zustand)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [AWS Amplify](https://docs.amplify.aws/)

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes
3. Test thoroughly
4. Commit: `git commit -m "feat: your feature"`
5. Push: `git push origin feature/your-feature`
6. Create Pull Request

---

## 📞 Support

Nếu gặp vấn đề, hãy:
1. Check `PROGRESS.md` để xem trạng thái hiện tại
2. Check console logs
3. Check React Query Devtools
4. Ask team members

---

**Happy Coding! 🚀**
