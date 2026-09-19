import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MotionConfig } from "framer-motion";
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
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <MotionConfig reducedMotion="user">
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
          </MotionConfig>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}