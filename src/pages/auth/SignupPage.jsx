import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, Loader2 } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { auth } from "../../lib/firebase";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { getAuthErrorMessage } from "../../lib/utils/auth-errors";

export default function SignupPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { user } = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Update user profile with name
      await updateProfile(user, {
        displayName: formData.name,
      });

      navigate("/dashboard");
    } catch (error) {
      setError(getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError("");
    setIsLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate("/dashboard");
    } catch (error) {
      setError(getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Welcome! Please fill in the details to get started"
    >
      <div className="space-y-6">
        {/* Google Sign In */}
        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-black  rounded-md shadow-sm text-sm font-medium hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <img
            src="https://www.google.com/favicon.ico"
            alt="Google"
            className="w-5 h-5"
          />
          <span>Continue with Google</span>
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 text-black text-muted-foreground">or</span>
          </div>
        </div>

        <form onSubmit={handleEmailSignup} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="firstName" className="block text-sm font-medium">
                First name
                <span className="text-xs text-muted-foreground ml-1">
                  (Optional)
                </span>
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                value={formData.firstName}
                onChange={handleChange}
                className="block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary bg-muted/50"
                placeholder="First name"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="lastName" className="block text-sm font-medium">
                Last name
                <span className="text-xs text-muted-foreground ml-1">
                  (Optional)
                </span>
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                autoComplete="family-name"
                value={formData.lastName}
                onChange={handleChange}
                className="block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary bg-muted/50"
                placeholder="Last name"
              />
            </div>
          </div>

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
                value={formData.email}
                onChange={handleChange}
                className="block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary bg-muted/50"
                placeholder="Enter your email address"
              />
              <Mail className="w-5 h-5 text-muted-foreground absolute right-3 top-2.5" />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <div className="mt-1 relative">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={handleChange}
                className="block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary bg-muted/50"
                placeholder="Create a password"
              />
              <Lock className="w-5 h-5 text-muted-foreground absolute right-3 top-2.5" />
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
              "Continue"
            )}
          </button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-primary hover:text-primary/90"
          >
            Sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
