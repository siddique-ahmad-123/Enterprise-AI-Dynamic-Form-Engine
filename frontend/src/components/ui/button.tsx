import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  className = "",
  children,
  ...props
}) => {
  const variantStyles = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs",
    secondary: "bg-slate-100 hover:bg-slate-200 text-slate-800",
    outline: "border border-slate-300 hover:bg-slate-50 text-slate-700",
  };

  return (
    <button
      className={`inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 cursor-pointer ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
