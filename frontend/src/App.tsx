import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Shell } from "./components/Shell";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./lib/toast";
import { HomePage } from "./pages/HomePage";
import { AuthPage } from "./pages/AuthPage";
import { CropPage } from "./pages/CropPage";
import { ScanPage } from "./pages/ScanPage";
import { VoicePage } from "./pages/VoicePage";
import { ProfilePage } from "./pages/ProfilePage";

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <MotionConfig reducedMotion="user">
              <ErrorBoundary>
                <Routes>
              <Route element={<Shell />}>
                <Route index element={<HomePage />} />
                <Route path="auth" element={<AuthPage />} />
                <Route path="crop" element={<CropPage />} />
                <Route path="scan" element={<ScanPage />} />
                <Route path="voice" element={<VoicePage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="*" element={<HomePage />} />
              </Route>
            </Routes>
              </ErrorBoundary>
            </MotionConfig>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}