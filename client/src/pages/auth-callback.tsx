import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function AuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get code from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
          console.error('OAuth error:', error);
          setTimeout(() => {
            setLocation('/');
          }, 3000);
          return;
        }

        if (!code) {
          console.error('No authorization code received');
          setTimeout(() => {
            setLocation('/');
          }, 3000);
          return;
        }

        // Store the code in localStorage for the main app to use
        localStorage.setItem('drive-auth-code', code);
        
        // Redirect back to main app
        setTimeout(() => {
          setLocation('/');
        }, 1000);

      } catch (error) {
        console.error('Auth callback error:', error);
        setTimeout(() => {
          setLocation('/');
        }, 3000);
      }
    };

    handleAuthCallback();
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <Card className="w-96">
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Đang xử lý xác thực...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-slate-600">
            <p>Đang hoàn tất kết nối với Google Drive...</p>
            <p className="text-sm mt-2">Bạn sẽ được chuyển hướng về trang chính trong giây lát.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
