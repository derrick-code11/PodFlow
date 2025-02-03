import { Link } from "react-router-dom";
import authBg from "../../assets/images/female-podcaster.jpg";

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <img
          src={authBg}
          alt="Female podcaster"
          className="w-full h-full object-cover"
        />
        <div className="absolute bg-background/60 backdrop-blur-[2px]" />
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-[400px] rounded-lg shadow-2xl border border-border/40 backdrop-blur-sm bg-card/80">
        {/* Logo and Header */}
        <div className="p-8 pb-6 flex flex-col items-center">
          <Link to="/" className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              PodFlow
            </h1>
          </Link>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {/* Form Content */}
        <div className="p-8 pt-2">{children}</div>
      </div>
    </div>
  );
}
