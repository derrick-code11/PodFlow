import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { getAuthErrorMessage } from "../../lib/utils/auth-errors";
import AuthLayout from "./AuthLayout";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (error) {
      setError(getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email address and we'll send you a link to reset your password"
    >
      <div className="space-y-6">
        {success ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Check your email</h3>
                <p className="text-sm text-muted-foreground">
                  We've sent you a password reset link to {email}
                </p>
              </div>
            </div>
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => navigate("/login")}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Return to login
              </button>
              <button
                onClick={() => {
                  setEmail("");
                  setSuccess(false);
                }}
                className="text-sm font-medium text-primary hover:text-primary/90"
              >
                Send another email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-medium">
                Email address
              </label>
              <div className="mt-1 relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary bg-muted/50"
                  placeholder="Enter your email address"
                />
                <Mail className="w-5 h-5 text-muted-foreground absolute right-3 top-2.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Send reset link"
              )}
            </button>

            <Link
              to="/login"
              className="flex items-center justify-center text-sm font-medium text-primary hover:text-primary/90"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to login
            </Link>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
